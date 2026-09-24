# パッケージ構成：hikari-components

Hikari のコンポーネント体系は単一のパッケージ `hikari-components` に集約されています。`rsx!` で
書かれた描画コンポーネントが、リアクティブ hooks・型付き palette class・`StyledComponent` CSS を
伴ってここにあります。

> **廃止：`hikari-extra-components`。** このパッケージは描画コンポーネントとは別に、フレームワーク
> 非依存の*データモデル*（`TimelineState`、`ZoomControlsState`、`GuideStep`、ノードグラフモデルなど）
> を提供していました。そのため同一概念に同名型が二つ存在し、たとえば `TimelinePosition` の既定値は
> 一方が `Left`、他方が `Alternate` でした。ワークスペース内に依存はなく、ノードグラフモデルも
> 自身のテスト以外から参照されていなかったため、パッケージごと削除しました。重複していた
> コンポーネントはすべてこちらに残っています：`display::{Timeline, DragLayer, UserGuide,
> ZoomControls}`、`production::{VideoPlayer, RichTextEditor, CodeHighlight}`。
