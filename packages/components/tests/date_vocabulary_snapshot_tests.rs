//! Frozen snapshot of the localized date text the components render.
//!
//! This is the third layer of the date-vocabulary guard. The first two live in
//! `hikari-i18n` (the generated table must match the frozen CLDR snapshot
//! cell by cell, and every language must carry all seven shapes); this one
//! pins what the CALENDAR actually prints, i.e. the composition of names with
//! the per-language segment order and glue.
//!
//! Why freeze literal strings instead of deriving the expectation from the
//! same table: the failure this layer exists for is a *composition* mistake —
//! picking the standalone month where a composed date needs the format shape
//! (Russian header "октябрь" vs "октября"), rotating the weekday grid from the
//! wrong anchor, or dropping a separator. A derived expectation would repeat
//! that mistake and stay green. Every string below was reviewed against the
//! CLDR rows of `packages/i18n/src/dates/names.golden.toml` when the table
//! landed; a change here is a user-visible text change and needs the same
//! review, not a snapshot refresh.
//!
//! The shape of the assertion is deliberately dumb: one row per language, one
//! line per language, so a diff names exactly which locale and which surface
//! moved.

#[cfg(test)]
mod tests {
    use hikari_components::basic::date_picker::{
        date_locale, day_view_month_label, locale_month_grid, month_pick_label, parse_iso_date,
    };
    use hikari_components::data::calendar_heatmap::{heatmap_month_label, heatmap_weekday_label};
    use hikari_i18n::Language;

    /// `(language code, first weekday, header, medium, month/day, full, grid)`
    /// — 2024-10-06 is a Sunday, so the medium/full texts also prove the
    /// weekday-name side of the vocabulary.
    const SNAPSHOT: &[(&str, u32, &str, &str, &str, &str, &str)] = &[
        (
            "en",
            0,
            "October 2024",
            "Oct 6, 2024",
            "Oct 6",
            "Sunday, October 6, 2024",
            "Sun,Mon,Tue,Wed,Thu,Fri,Sat",
        ),
        (
            "zh-Hans",
            1,
            "2024年10月",
            "2024年10月6日",
            "10月6日",
            "2024年10月6日星期日",
            "周一,周二,周三,周四,周五,周六,周日",
        ),
        (
            "zh-Hant",
            0,
            "2024年10月",
            "2024年10月6日",
            "10月6日",
            "2024年10月6日星期日",
            "週日,週一,週二,週三,週四,週五,週六",
        ),
        (
            "ja",
            0,
            "2024年10月",
            "2024年10月6日",
            "10月6日",
            "2024年10月6日日曜日",
            "日,月,火,水,木,金,土",
        ),
        (
            "ko",
            0,
            "2024년 10월",
            "2024. 10. 6.",
            "10월 6일",
            "2024년 10월 6일 일요일",
            "일,월,화,수,목,금,토",
        ),
        (
            "fr",
            1,
            "octobre 2024",
            "6 oct. 2024",
            "6 oct.",
            "dimanche 6 octobre 2024",
            "lun.,mar.,mer.,jeu.,ven.,sam.,dim.",
        ),
        (
            "de",
            1,
            "Oktober 2024",
            "6 Okt. 2024",
            "6 Okt.",
            "Sonntag 6 Oktober 2024",
            "Mo,Di,Mi,Do,Fr,Sa,So",
        ),
        (
            "es",
            1,
            "octubre 2024",
            "6 oct 2024",
            "6 oct",
            "domingo 6 octubre 2024",
            "lun,mar,mié,jue,vie,sáb,dom",
        ),
        (
            "pt",
            0,
            "outubro 2024",
            "6 out. 2024",
            "6 out.",
            "domingo 6 outubro 2024",
            "dom.,seg.,ter.,qua.,qui.,sex.,sáb.",
        ),
        (
            "ru",
            1,
            "октябрь 2024",
            "6 окт. 2024",
            "6 окт.",
            "воскресенье 6 октября 2024",
            "пн,вт,ср,чт,пт,сб,вс",
        ),
        (
            // `ar` (no region) is Saturday-first in CLDR — the tag the Vue side
            // passes, and why this row is not the Sunday-first `ar-SA`.
            "ar",
            6,
            "أكتوبر 2024",
            "6 أكتوبر 2024",
            "6 أكتوبر",
            "الأحد 6 أكتوبر 2024",
            "السبت,الأحد,الاثنين,الثلاثاء,الأربعاء,الخميس,الجمعة",
        ),
    ];

    #[test]
    fn every_language_renders_the_frozen_date_text() {
        let day = parse_iso_date("2024-10-06").expect("2024-10-06 is a valid ISO date");
        assert_eq!(
            SNAPSHOT.len(),
            hikari_i18n::Language::ALL.len(),
            "the snapshot must cover every supported language"
        );

        for (code, first_weekday, header, medium, month_day, full, grid) in SNAPSHOT {
            let language = hikari_i18n::Language::from_code(code)
                .unwrap_or_else(|| panic!("{code}: not a hikari_i18n::Language code"));
            let locale = date_locale(language);
            assert_eq!(
                locale.first_weekday(),
                *first_weekday,
                "{code}: first weekday"
            );
            assert_eq!(locale.header_label(2024, 10), *header, "{code}: header");
            assert_eq!(locale.display_text(day), *medium, "{code}: medium date");
            assert_eq!(locale.short_text(day), *month_day, "{code}: month + day");
            assert_eq!(locale.full_text(day), *full, "{code}: full date");
            assert_eq!(
                locale.weekday_labels(false).join(","),
                *grid,
                "{code}: weekday grid order"
            );
        }
    }

    /// The render must ask the LOCALE for its first weekday, not pass a
    /// constant — zh-Hans is Monday-first while English is Sunday-first, and
    /// 2024-10-01 is a Tuesday, so the two grids open one day apart.
    #[test]
    fn the_day_grid_opens_on_the_locales_first_weekday() {
        let chinese = date_locale(Language::ChineseSimplified);
        let cells = locale_month_grid(&chinese, 2024, 10);
        assert_eq!(cells.len(), 42, "six rows of seven cells");
        assert_eq!(
            cells[0],
            parse_iso_date("2024-09-30").unwrap(),
            "zh-Hans opens on Monday"
        );
        let english = date_locale(Language::English);
        assert_eq!(
            locale_month_grid(&english, 2024, 10)[0],
            parse_iso_date("2024-09-29").unwrap(),
            "English opens on Sunday"
        );
    }

    /// The month-picker cells and the day-view title are BARE months, so they
    /// must read the standalone shapes; German is where the two CLDR shapes
    /// differ visibly ("Jan" vs "Jan.", "Oktober" vs "Oktober").
    #[test]
    fn bare_month_labels_use_the_standalone_shapes() {
        let german = date_locale(Language::German);
        assert_eq!(month_pick_label(&german, 1), "Jan");
        assert_eq!(german.month_short_format(1), "Jan.");
        let russian = date_locale(Language::Russian);
        assert_eq!(day_view_month_label(&russian, 10), "октябрь");
        assert_eq!(russian.month_long_format(10), "октября");
        // A composed date would use the format shape; the title must not.
        assert_ne!(
            day_view_month_label(&russian, 10),
            russian.month_long_format(10)
        );
    }

    /// The heatmap's month markers are BARE months, so they must read the
    /// STANDALONE short shape — and English cannot tell the two shapes apart
    /// ("Dec" is both), so this pins a language where the abbreviation only
    /// changes inside a date. Mutation that swaps the shape stayed green
    /// before this test existed.
    #[test]
    fn heatmap_month_markers_use_the_standalone_short_month() {
        let russian = date_locale(Language::Russian);
        assert_eq!(heatmap_month_label(&russian, "3"), "март");
        assert_eq!(
            heatmap_month_label(&russian, "3"),
            russian.month_short_standalone(3),
            "March standalone is 'март'; only a composed date uses 'мар.'"
        );
        let german = date_locale(Language::German);
        assert_eq!(heatmap_month_label(&german, "1"), "Jan");
        assert_ne!(
            heatmap_month_label(&german, "1"),
            german.month_short_format(1),
            "German in-date March is 'Jan.', the marker is not"
        );
        assert_eq!(heatmap_month_label(&german, ""), "");
        assert_eq!(heatmap_month_label(&german, "13"), "");
    }

    /// The heatmap's weekday rail is MONDAY-first regardless of the locale's
    /// own first weekday (Vue formats `Date.UTC(2024, 0, 1 + index)`, and
    /// 2024-01-01 is a Monday), while the vocabulary arrays are Sunday-first —
    /// so the rail is a `+ 1` rotation. That rotation is what this pins: it was
    /// a `date.format_localized("%a")` call before the table landed, and an
    /// off-by-one there is invisible to every other test.
    #[test]
    fn the_heatmap_rail_starts_on_monday() {
        let english = date_locale(Language::English);
        let rail: Vec<String> = (0..7).map(|i| heatmap_weekday_label(&english, i)).collect();
        assert_eq!(
            rail,
            ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            "English rail is Monday-first"
        );
        assert_eq!(
            heatmap_weekday_label(&english, 7),
            "",
            "past the week: empty"
        );

        // A locale whose own week starts on Monday must yield the same order.
        let russian = date_locale(Language::Russian);
        let ru: Vec<String> = (0..7).map(|i| heatmap_weekday_label(&russian, i)).collect();
        assert_eq!(ru[0], "пн");
        assert_eq!(ru[6], "вс");
    }

    /// The two SHORT shapes are separate accessors for a reason: a bare month
    /// cell must not inherit the in-date abbreviation, and German/Russian are
    /// the languages where CLDR actually differs ("Jan" vs "Jan.", "март" vs
    /// "мар."). The month-picker grid reads the standalone one; this pins the
    /// pair so a swap is at least visible at the vocabulary layer.
    #[test]
    fn the_short_month_shapes_stay_distinct_where_cldr_says_so() {
        let german = date_locale(Language::German);
        assert_eq!(german.month_short_standalone(1), "Jan");
        assert_eq!(german.month_short_format(1), "Jan.");
        let russian = date_locale(Language::Russian);
        assert_eq!(russian.month_short_standalone(3), "март");
        assert_eq!(russian.month_short_format(3), "мар.");
        // English has one shape in both contexts.
        let english = date_locale(Language::English);
        assert_eq!(
            english.month_short_standalone(1),
            english.month_short_format(1)
        );
    }

    /// The header and a composed date use DIFFERENT CLDR shapes, and the
    /// vocabulary exposes both under separate names so a call site cannot
    /// silently pick the wrong one. Russian is the language where the two
    /// shapes actually differ ("октябрь" standalone vs "октября" in a date) —
    /// with the glibc data only the genitive existed, which is what made the
    /// header read "октября 2024".
    #[test]
    fn the_header_uses_the_standalone_month_while_a_date_uses_the_format_month() {
        let day = parse_iso_date("2024-10-06").expect("valid date");
        let russian = date_locale(hikari_i18n::Language::Russian);
        assert!(russian.header_label(2024, 10).starts_with("октябрь "));
        assert!(russian.full_text(day).contains("октября"));
        assert_ne!(
            russian.month_long_standalone(10),
            russian.month_long_format(10),
            "ru standalone and format months must stay distinct"
        );

        // English has one shape for both contexts; the accessors still agree.
        let english = date_locale(hikari_i18n::Language::English);
        assert_eq!(english.month_long_standalone(10), "October");
        assert_eq!(english.month_long_format(10), "October");
    }
}
