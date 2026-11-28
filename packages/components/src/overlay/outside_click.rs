//! Outside click — the page-wide "clicked somewhere else" that closes a
//! surface.
//!
//! Vue's `HkPopover`, `HkSelectPanel` and `HkMenu` each install a
//! capture-phase listener on the document
//! (`document.addEventListener("click", onDocumentClick, true)`) that closes
//! them when a click lands outside their own box. The Rust mirrors render the
//! same boxes but had no listener, so a host had to dismiss every surface
//! itself.
//!
//! One listener per page serves every surface. A surface arms a shield on
//! each render in which it is open ([`arm`]) and carries the shield's key in
//! `data-hk-outside` on its root; the listener hands each click to
//! [`dispatch`], which runs the close callback of every shield whose surface
//! the click missed.
//!
//! A shield is known by its surface, never by a component identity: tairitsu
//! has no per-instance hook state (a nested component is a plain function
//! call under the registering component's id), so every render mints a fresh
//! key and the entry of the previous render simply finds no element. That is
//! also what retires a shield whose surface closed or unmounted without a
//! click in between — it never fires, because a shield only acts while its
//! element is in the document. The first miss is kept (a click can race the
//! commit of the render that armed the shield); the second drops the entry.
//!
//! Vue teleports its layers to `<body>` and tells "a layer stacked above me"
//! from "the page" through a popup-manager z registry. These mirrors render
//! in place, so DOM containment is the nesting protocol: a surface opened
//! from inside another one sits inside its box and does not count as outside.

use std::cell::{Cell, RefCell};

use crate::platform::{self, ClickLocation};

/// Marks the root of a surface that closes on an outside click; the value is
/// the shield key ([`ShieldKey::value`]).
pub const SURFACE_ATTR: &str = "data-hk-outside";

/// Marks the trigger of a surface — the element that toggles it; the value is
/// the same shield key. A click inside the trigger never counts as outside:
/// the trigger toggles, and closing first would make that toggle reopen the
/// surface.
pub const TRIGGER_ATTR: &str = "data-hk-outside-trigger";

/// Shields kept at once. Entries only pile up while an open surface
/// re-renders between two clicks (each render arms a fresh key); past this
/// the stale ones are dropped first — see [`make_room`].
const MAX_SHIELDS: usize = 64;

/// Clicks that found no element before a shield is dropped.
const STALE_MISSES: u32 = 2;

thread_local! {
    static SHIELDS: RefCell<Vec<(ShieldKey, Shield)>> = const { RefCell::new(Vec::new()) };
    static NEXT_KEY: Cell<u64> = const { Cell::new(0) };
    static LISTENING: Cell<bool> = const { Cell::new(false) };
}

/// A shield's identity, minted per render of an open surface.
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct ShieldKey(String);

impl ShieldKey {
    pub fn new() -> Self {
        let next = NEXT_KEY.with(|next| {
            let current = next.get();
            next.set(current + 1);
            current
        });
        ShieldKey(format!("hk-{next}"))
    }

    /// The value for [`SURFACE_ATTR`] / [`TRIGGER_ATTR`].
    pub fn value(&self) -> &str {
        &self.0
    }

    /// The selector that matches the surface root.
    pub fn surface_selector(&self) -> String {
        format!("[{SURFACE_ATTR}=\"{}\"]", self.0)
    }

    /// The selector that matches the trigger.
    pub fn trigger_selector(&self) -> String {
        format!("[{TRIGGER_ATTR}=\"{}\"]", self.0)
    }
}

impl Default for ShieldKey {
    fn default() -> Self {
        Self::new()
    }
}

struct Shield {
    /// Selectors whose elements never count as outside (the trigger).
    ignore: Vec<String>,
    close: Box<dyn FnMut()>,
    /// Consecutive clicks that found no surface element.
    misses: u32,
}

/// The questions the registry asks about a click and the page. A live click
/// answers through the platform; tests script the answers.
trait Page {
    /// The click landed inside an element matching `selector`, or inside a
    /// descendant of one.
    fn inside(&self, selector: &str) -> bool;

    /// The document holds an element matching `selector`.
    fn exists(&self, selector: &str) -> bool;
}

/// A click on the live page: `inside` from the event, `exists` from the
/// document.
struct PageClick<'a>(&'a dyn ClickLocation);

impl Page for PageClick<'_> {
    fn inside(&self, selector: &str) -> bool {
        self.0.inside(selector)
    }

    fn exists(&self, selector: &str) -> bool {
        platform::query_selector(selector).is_some()
    }
}

/// The live document without a click (an arm-time trim).
struct LiveDocument;

impl Page for LiveDocument {
    fn inside(&self, _selector: &str) -> bool {
        false
    }

    fn exists(&self, selector: &str) -> bool {
        platform::query_selector(selector).is_some()
    }
}

/// Register (or refresh) the shield `key`: the next page click that lands
/// outside the surface carrying `key` and outside every `ignore` selector
/// runs `close`. Call it on every render of the open surface, so the callback
/// is never the one of an older render.
///
/// Returns `false` — and registers nothing — where the platform has no page
/// to listen on (SSR, native): the caller then leaves the key out of its
/// markup, so server output stays free of per-render values.
pub fn arm(key: &ShieldKey, ignore: Vec<String>, close: impl FnMut() + 'static) -> bool {
    if !ensure_listener() {
        return false;
    }
    SHIELDS.with(|shields| {
        let mut shields = shields.borrow_mut();
        let shield = Shield {
            ignore,
            close: Box::new(close),
            misses: 0,
        };
        let existing = shields.iter().position(|(armed, _)| armed == key);
        match existing {
            Some(index) => shields[index].1 = shield,
            None => {
                make_room(&mut shields, &LiveDocument);
                shields.push((key.clone(), shield));
            }
        }
    });
    true
}

/// Forget `key`: its surface no longer closes on outside clicks.
pub fn release(key: &ShieldKey) {
    SHIELDS.with(|shields| shields.borrow_mut().retain(|(armed, _)| armed != key));
}

/// Whether there is a page to shield against, installing the listener if
/// there is not one yet. A component that must publish a key BEFORE the
/// render that arms it (a wrapper standing in for a nested surface's
/// trigger) asks this, so the key never reaches markup nothing will read.
pub fn prepare() -> bool {
    ensure_listener()
}

/// Vue's `onDocumentClick` guard for one surface: close unless the click
/// landed inside the surface or inside one of the elements it ignores.
pub fn click_closes(inside_surface: bool, inside_ignored: bool) -> bool {
    !inside_surface && !inside_ignored
}

/// Make room for one more shield. Entries are dropped in this order: those
/// that already missed a click, those whose surface is no longer in the
/// document, then the oldest — so a surface that stays open is never evicted
/// for the stale keys of one that re-renders.
fn make_room(shields: &mut Vec<(ShieldKey, Shield)>, page: &dyn Page) {
    while shields.len() >= MAX_SHIELDS {
        let missed = shields.iter().position(|(_, shield)| shield.misses > 0);
        let gone = || {
            shields
                .iter()
                .position(|(key, _)| !page.exists(&key.surface_selector()))
        };
        let victim = missed.or_else(gone).unwrap_or(0);
        shields.remove(victim);
    }
}

fn dispatch(page: &dyn Page) {
    let keys: Vec<ShieldKey> = SHIELDS.with(|shields| {
        shields
            .borrow()
            .iter()
            .map(|(key, _)| key.clone())
            .collect()
    });
    for key in keys {
        // Take the shield out before anything can re-enter the registry: the
        // close callback may render, and a render arms shields.
        let taken = SHIELDS.with(|shields| {
            shields
                .borrow_mut()
                .extract_if(.., |(armed, _)| armed == &key)
                .next()
        });
        let Some((_, mut shield)) = taken else {
            continue;
        };
        let surface = key.surface_selector();
        if !page.exists(&surface) {
            // Closed, unmounted, or not committed yet.
            shield.misses += 1;
            if shield.misses < STALE_MISSES {
                SHIELDS.with(|shields| shields.borrow_mut().push((key, shield)));
            }
            continue;
        }
        shield.misses = 0;
        let inside_ignored = shield.ignore.iter().any(|selector| page.inside(selector));
        if !click_closes(page.inside(&surface), inside_ignored) {
            SHIELDS.with(|shields| shields.borrow_mut().push((key, shield)));
            continue;
        }
        (shield.close)();
        // A host that kept the surface open still needs its shield. A render
        // inside the callback armed a fresh key for it, and that one wins.
        let rearmed =
            SHIELDS.with(|shields| shields.borrow().iter().any(|(armed, _)| armed == &key));
        if !rearmed && page.exists(&surface) {
            SHIELDS.with(|shields| shields.borrow_mut().push((key, shield)));
        }
    }
}

/// Install the page listener once. `false` when the platform has no page to
/// listen on.
fn ensure_listener() -> bool {
    if LISTENING.with(|listening| listening.replace(true)) {
        return true;
    }
    if platform::on_document_click(|location| dispatch(&PageClick(location))) {
        return true;
    }
    // Nothing will ever dispatch here. Say so, and let the next arm retry.
    LISTENING.with(|listening| listening.set(false));
    false
}

/// A scripted click: the selectors it landed inside, and the selectors the
/// document holds.
#[cfg(test)]
struct Scripted<'a> {
    inside: &'a [&'a str],
    present: &'a [&'a str],
}

#[cfg(test)]
impl Page for Scripted<'_> {
    fn inside(&self, selector: &str) -> bool {
        self.inside.contains(&selector)
    }

    fn exists(&self, selector: &str) -> bool {
        self.present.contains(&selector)
    }
}

/// A page that listens but has no browser, for tests: shields arm, and a test
/// dispatches clicks itself. The registry and the listener flag are emptied
/// when the page is dropped.
#[cfg(test)]
pub(crate) struct TestPage;

#[cfg(test)]
impl TestPage {
    pub fn new() -> Self {
        LISTENING.with(|listening| listening.set(true));
        SHIELDS.with(|shields| shields.borrow_mut().clear());
        TestPage
    }

    /// Dispatch a click that landed inside the elements matching `inside`,
    /// on a document holding the elements matching `present`.
    pub fn click(&self, inside: &[&str], present: &[&str]) {
        dispatch(&Scripted { inside, present });
    }

    /// The shields currently registered, oldest first.
    pub fn armed(&self) -> Vec<ShieldKey> {
        SHIELDS.with(|shields| {
            shields
                .borrow()
                .iter()
                .map(|(key, _)| key.clone())
                .collect()
        })
    }
}

#[cfg(test)]
impl Default for TestPage {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
impl Drop for TestPage {
    fn drop(&mut self) {
        SHIELDS.with(|shields| shields.borrow_mut().clear());
        LISTENING.with(|listening| listening.set(false));
    }
}

#[cfg(test)]
mod tests {
    use std::rc::Rc;

    use super::*;

    /// A close callback that counts its calls.
    #[derive(Clone, Default)]
    struct Tally(Rc<Cell<u32>>);

    impl Tally {
        fn hits(&self) -> u32 {
            self.0.get()
        }
    }

    fn counting() -> (Tally, impl FnMut() + 'static) {
        let tally = Tally::default();
        let counter = tally.clone();
        let close = move || counter.0.set(counter.0.get() + 1);
        (tally, close)
    }

    /// A scripted document: what it holds, and where the next click lands.
    /// Both can change while a click is dispatched, the way a synchronous
    /// re-render inside a close callback changes the real one.
    #[derive(Clone, Default)]
    struct Document(Rc<RefCell<(Vec<String>, Vec<String>)>>);

    impl Document {
        fn holding(selectors: &[&ShieldKey]) -> Self {
            let held = selectors.iter().map(|key| key.surface_selector()).collect();
            Document(Rc::new(RefCell::new((held, Vec::new()))))
        }

        fn click_on(&self, key: &ShieldKey) {
            self.0.borrow_mut().1 = vec![key.surface_selector()];
        }

        fn click_on_selector(&self, selector: &str) {
            self.0.borrow_mut().1 = vec![selector.to_string()];
        }

        fn holds(&self, key: &ShieldKey) -> bool {
            self.0.borrow().0.contains(&key.surface_selector())
        }

        /// The surface of `key` is now in the document.
        fn remember(&self, key: &ShieldKey) {
            self.0.borrow_mut().0.push(key.surface_selector());
        }

        /// The surface of `key` left the document (closed, or not committed yet).
        fn forget(&self, key: &ShieldKey) {
            self.0
                .borrow_mut()
                .0
                .retain(|selector| selector != &key.surface_selector());
        }
    }

    impl Page for Document {
        fn inside(&self, selector: &str) -> bool {
            self.0.borrow().1.iter().any(|held| held == selector)
        }

        fn exists(&self, selector: &str) -> bool {
            self.0.borrow().0.iter().any(|held| held == selector)
        }
    }

    /// Arm a shield for a controlled surface that is in the document: its
    /// host closes it when asked, which takes its element out again.
    fn arm_controlled(page: &TestPage, document: &Document, ignore: &[&str]) -> (ShieldKey, Tally) {
        let key = ShieldKey::new();
        let (tally, mut close) = counting();
        let host = document.clone();
        let closed = key.clone();
        assert!(arm(
            &key,
            ignore.iter().map(|selector| selector.to_string()).collect(),
            move || {
                close();
                host.forget(&closed);
            }
        ));
        document.remember(&key);
        assert_eq!(
            page.armed().last(),
            Some(&key),
            "the shield is registered, newest last"
        );
        (key, tally)
    }

    #[test]
    fn a_click_outside_the_surface_closes() {
        let page = TestPage::new();
        let document = Document::default();
        let (key, tally) = arm_controlled(&page, &document, &[]);
        assert!(document.holds(&key));
        document.click_on_selector("body");
        dispatch(&document);
        assert_eq!(tally.hits(), 1);
        assert!(
            page.armed().is_empty(),
            "a closed surface leaves no shield behind"
        );
    }

    #[test]
    fn a_click_inside_the_surface_is_ignored() {
        let page = TestPage::new();
        let document = Document::default();
        let (key, tally) = arm_controlled(&page, &document, &[]);
        document.click_on(&key);
        dispatch(&document);
        assert_eq!(tally.hits(), 0);
        assert_eq!(page.armed(), vec![key]);
    }

    #[test]
    fn a_click_on_an_ignored_element_is_ignored() {
        let page = TestPage::new();
        let document = Document::default();
        let (key, tally) = arm_controlled(&page, &document, &["#trigger"]);
        document.click_on_selector("#trigger");
        dispatch(&document);
        assert_eq!(tally.hits(), 0, "the trigger toggles the surface itself");
        assert_eq!(page.armed(), vec![key]);
    }

    #[test]
    fn of_two_surfaces_only_the_one_the_click_missed_closes() {
        let page = TestPage::new();
        let document = Document::default();
        let (first, first_tally) = arm_controlled(&page, &document, &[]);
        let (second, second_tally) = arm_controlled(&page, &document, &[]);
        document.click_on(&first);
        dispatch(&document);
        assert_eq!(first_tally.hits(), 0);
        assert_eq!(second_tally.hits(), 1);
        assert!(document.holds(&first) && !document.holds(&second));
        assert_eq!(page.armed(), vec![first]);
    }

    #[test]
    fn a_surface_that_is_gone_never_fires_and_is_dropped_on_its_second_miss() {
        let page = TestPage::new();
        let document = Document::default();
        let (key, tally) = arm_controlled(&page, &document, &[]);
        document.forget(&key);
        document.click_on_selector("body");
        dispatch(&document);
        assert_eq!(tally.hits(), 0, "a closed surface is not closed again");
        assert_eq!(
            page.armed(),
            vec![key.clone()],
            "the first miss is kept for a click that races the commit"
        );
        dispatch(&document);
        assert!(page.armed().is_empty(), "the second miss drops the shield");
        document.remember(&key);
        dispatch(&document);
        assert_eq!(tally.hits(), 0, "a dropped shield stays dropped");
    }

    #[test]
    fn a_miss_is_forgotten_once_the_surface_is_seen_again() {
        let page = TestPage::new();
        let document = Document::default();
        let (key, _) = arm_controlled(&page, &document, &[]);
        document.forget(&key);
        document.click_on(&key);
        dispatch(&document);
        document.remember(&key);
        dispatch(&document);
        document.forget(&key);
        dispatch(&document);
        assert_eq!(
            page.armed(),
            vec![key],
            "the misses do not add up across clicks that found the surface"
        );
    }

    #[test]
    fn a_host_that_keeps_its_surface_open_keeps_its_shield() {
        // No `on_open_change`, or a parent that vetoes: the surface stays in
        // the document, so the next outside click must reach it too.
        let page = TestPage::new();
        let key = ShieldKey::new();
        let (tally, close) = counting();
        assert!(arm(&key, Vec::new(), close));
        let document = Document::holding(&[&key]);
        document.click_on_selector("body");
        dispatch(&document);
        dispatch(&document);
        assert_eq!(tally.hits(), 2);
        assert_eq!(page.armed(), vec![key]);
    }

    #[test]
    fn a_render_inside_the_close_callback_leaves_the_fresh_shield_alone() {
        // tairitsu applies signal writes synchronously: the callback can
        // render, and a render arms shields. The re-armed key must be the one
        // that survives, without the registry being borrowed twice.
        let page = TestPage::new();
        let key = ShieldKey::new();
        let fresh = ShieldKey::new();
        let document = Document::holding(&[&key]);
        let rendered = document.clone();
        let old = key.clone();
        let new = fresh.clone();
        let (tally, mut close) = counting();
        assert!(arm(&key, Vec::new(), move || {
            close();
            rendered.forget(&old);
            arm(&new, Vec::new(), || {});
        }));
        document.click_on_selector("body");
        dispatch(&document);
        assert_eq!(tally.hits(), 1);
        assert_eq!(
            page.armed(),
            vec![fresh],
            "the old key is gone, the fresh one stays"
        );
    }

    #[test]
    fn a_released_shield_stops_closing() {
        let page = TestPage::new();
        let key = ShieldKey::new();
        let (tally, close) = counting();
        assert!(arm(&key, Vec::new(), close));
        release(&key);
        assert!(page.armed().is_empty());
        let document = Document::holding(&[&key]);
        document.click_on_selector("body");
        dispatch(&document);
        assert_eq!(tally.hits(), 0);
    }

    #[test]
    fn arming_the_same_key_again_refreshes_its_callback() {
        let page = TestPage::new();
        let key = ShieldKey::new();
        let (first, first_close) = counting();
        let (second, second_close) = counting();
        assert!(arm(&key, Vec::new(), first_close));
        assert!(arm(&key, Vec::new(), second_close));
        assert_eq!(page.armed().len(), 1);
        let document = Document::holding(&[&key]);
        document.click_on_selector("body");
        dispatch(&document);
        assert_eq!(
            first.hits(),
            0,
            "the callback of the older render is replaced"
        );
        assert_eq!(second.hits(), 1);
    }

    #[test]
    fn without_a_page_nothing_is_armed() {
        // The native stub answers `false`: a server render mints no shields.
        LISTENING.with(|listening| listening.set(false));
        SHIELDS.with(|shields| shields.borrow_mut().clear());
        let key = ShieldKey::new();
        assert!(!arm(&key, Vec::new(), || {}));
        assert!(SHIELDS.with(|shields| shields.borrow().is_empty()));
        LISTENING.with(|listening| listening.set(false));
    }

    #[test]
    fn the_registry_stays_bounded() {
        let page = TestPage::new();
        for _ in 0..(MAX_SHIELDS + 20) {
            let key = ShieldKey::new();
            assert!(arm(&key, Vec::new(), || {}));
        }
        assert_eq!(page.armed().len(), MAX_SHIELDS);
    }

    #[test]
    fn trimming_drops_the_stale_shields_before_the_live_one() {
        let entry = |key: &ShieldKey, misses| {
            (
                key.clone(),
                Shield {
                    ignore: Vec::new(),
                    close: Box::new(|| {}),
                    misses,
                },
            )
        };
        let live = ShieldKey::new();
        let missed = ShieldKey::new();
        let gone = ShieldKey::new();
        let stale: Vec<ShieldKey> = (0..2).map(|_| ShieldKey::new()).collect();
        let present: Vec<ShieldKey> = (0..(MAX_SHIELDS - 2)).map(|_| ShieldKey::new()).collect();
        let mut shields = vec![entry(&live, 0), entry(&missed, 1), entry(&gone, 0)];
        shields.extend(stale.iter().map(|key| entry(key, 0)));
        shields.extend(present.iter().map(|key| entry(key, 0)));
        assert_eq!(shields.len(), MAX_SHIELDS + 3);
        // Four entries too many: the one that missed a click, the one whose
        // surface is gone, then the keys no render commits any more.
        let document = Document::holding(&[&live]);
        for key in &present {
            document.remember(key);
        }
        make_room(&mut shields, &document);
        let keys: Vec<ShieldKey> = shields.iter().map(|(key, _)| key.clone()).collect();
        assert_eq!(
            shields.len(),
            MAX_SHIELDS - 1,
            "one slot is made for exactly one shield"
        );
        assert!(
            !keys.contains(&missed),
            "an entry that already missed a click goes first"
        );
        assert!(!keys.contains(&gone), "then an entry whose surface is gone");
        assert!(
            stale.iter().all(|key| !keys.contains(key)),
            "then the keys no render commits any more"
        );
        assert!(
            keys.contains(&live),
            "the surface that is still in the document stays"
        );
    }

    #[test]
    fn click_closes_only_outside_everything() {
        assert!(click_closes(false, false));
        assert!(!click_closes(true, false));
        assert!(!click_closes(false, true));
        assert!(!click_closes(true, true));
    }

    #[test]
    fn keys_are_unique_and_their_selectors_match_the_attributes() {
        let first = ShieldKey::new();
        let second = ShieldKey::new();
        assert_ne!(first, second);
        assert_eq!(
            first.surface_selector(),
            format!("[{SURFACE_ATTR}=\"{}\"]", first.value())
        );
        assert_eq!(
            first.trigger_selector(),
            format!("[{TRIGGER_ATTR}=\"{}\"]", first.value())
        );
    }
}
