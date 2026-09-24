# بنية الحزم: hikari-components

يقع نظام مكوّنات Hikari في حزمة واحدة هي `hikari-components`: مكوّنات العرض المكتوبة بـ `rsx!`
مع خطّافاتها التفاعلية وأصناف اللوحة المُنمَّطة و CSS الخاص بـ `StyledComponent`.

> **أُزيلت الحزمة `hikari-extra-components`.** كانت هذه الحزمة توفّر، إلى جانب مكوّنات العرض،
> *نماذج بيانات* مستقلّة عن الإطار (`TimelineState` و`ZoomControlsState` و`GuideStep` ونموذج
> مخطط العُقد …)، فصار للمفهوم الواحد نوعان بالاسم نفسه: فالقيمة الافتراضية لـ `TimelinePosition`
> هي `Left` في إحداهما و`Alternate` في الأخرى. لم يعتمد عليها أي عضو في مساحة العمل، ولم يُشِر إلى
> نموذج مخطط العُقد سوى اختباراته الخاصة، لذا أُزيلت الحزمة. أمّا المكوّنات التي كانت تكرّرها فكلّها
> باقية هنا: `display::{Timeline, DragLayer, UserGuide, ZoomControls}` و
> `production::{VideoPlayer, RichTextEditor, CodeHighlight}`.
