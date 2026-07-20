# CrowdCircuit Studio — UI/UX Specification v0.1

**Trạng thái:** Implementation-ready draft  
**Ngày:** 20/07/2026  
**Sản phẩm:** CrowdCircuit  
**Bề mặt giao diện:** CrowdCircuit Studio  
**Thương hiệu đầy đủ:** CrowdCircuit by MS24 Labs  
**Tagline:** *Turn live viewers into players.*  
**Tài liệu nền:** `crowdcircuit_system_design_v0.1.1.md`

---

## Changelog v0.1

Phiên bản đầu tiên định nghĩa UI/UX cho CrowdCircuit Studio:

- Chốt information architecture và app shell.
- Chốt light theme, design token và component inventory.
- Định nghĩa onboarding và primary user journeys.
- Định nghĩa wireframe cho các màn Overview, Connection, Events, Games, Mappings, Voice, Simulator, Diagnostics và Settings.
- Định nghĩa trạng thái loading, empty, warning, reconnecting, degraded và error.
- Liên kết thao tác UI với REST API và WebSocket contract trong System Design v0.1.1.
- Định nghĩa acceptance criteria cho frontend agent.
- Giới hạn rõ phạm vi MVP để tránh xây một “phi thuyền điều khiển livestream” trước khi connector chạy ổn định.

---

## 0. Quy ước tài liệu

### 0.1 Source of truth

- Tài liệu này là source of truth cho giao diện CrowdCircuit Studio.
- `crowdcircuit_system_design_v0.1.1.md` là source of truth cho backend, contract, API, WebSocket và runtime semantics.
- Khi hai tài liệu có xung đột:
  - Backend contract theo System Design.
  - Bố cục, interaction và nội dung UI theo UI/UX Specification.
- Frontend không tự tạo endpoint mới nếu tài liệu này chưa chỉ rõ đó là frontend-only state.

### 0.2 Thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| Studio | Dashboard điều khiển CrowdCircuit |
| Viewer | Người xem TikTok LIVE |
| Streamer | Người vận hành CrowdCircuit |
| Connector | Adapter nhận event TikTok LIVE |
| Event | Gift, comment, follow, like, share, join |
| Mapping | Rule chuyển event thành game action |
| Action | Lệnh được gửi tới game |
| Voice job | Một câu TTS đang chờ, sinh hoặc phát |
| Active game | Game duy nhất đang nhận mapping trong thời điểm hiện tại |
| Browser source | Trang web được OBS/TikTok LIVE Studio capture |
| Mock event | Event giả lập dùng để kiểm thử |
| Runtime session | Phiên chạy từ lúc backend start tới khi restart |

---

# 1. Mục tiêu UX

CrowdCircuit Studio phải giúp streamer:

1. Bắt đầu phiên tương tác trong vài phút.
2. Nhìn một màn hình là biết hệ thống có đang hoạt động bình thường hay không.
3. Kết nối TikTok, game và voice mà không cần mở terminal.
4. Cấu hình gift/comment → action mà không phải sửa JSON thủ công.
5. Kiểm thử toàn bộ pipeline mà không cần LIVE hoặc donate thật.
6. Xử lý sự cố trong lúc đang LIVE bằng các thao tác nhanh, an toàn.
7. Không vô tình tạo spam action hoặc spam voice.
8. Không cần hiểu toàn bộ kiến trúc backend để vận hành hệ thống.

## 1.1 UX success metrics

MVP được coi là đạt UX mục tiêu khi:

- Người dùng mới hoàn thành onboarding và phát mock gift đầu tiên trong dưới 5 phút.
- Từ Overview, người dùng nhận biết lỗi connector/game/voice trong dưới 5 giây.
- Emergency controls luôn truy cập được trong tối đa 1 thao tác.
- Tạo mapping cơ bản `Rose → SPAWN_ZOMBIE` trong dưới 60 giây.
- Test mapping không cần rời màn Mapping Editor.
- Chuyển active game không làm người dùng hiểu nhầm rằng action cũ sẽ tiếp tục gửi.
- Không có destructive action nào xảy ra ngay sau một click thiếu chủ ý.

---

# 2. Nguyên tắc thiết kế

## 2.1 Live-first

Giao diện được thiết kế cho tình huống người dùng đang livestream, có ít thời gian đọc và cần phản ứng nhanh.

- Trạng thái quan trọng phải dễ quét bằng mắt.
- Không yêu cầu đọc log để biết lỗi phổ biến.
- Nút khẩn cấp phải có nhãn rõ, không chỉ dùng icon.
- Không hiển thị modal dài trong luồng vận hành chính.
- Các thiết lập nâng cao được đặt sau disclosure hoặc Developer Mode.

## 2.2 Safe by default

- Voice mặc định không đọc comment tự do.
- Mapping mới mặc định `disabled` cho tới khi test thành công hoặc người dùng chủ động bật.
- Chuyển game dùng `Drain and Switch`, không hard-switch mặc định.
- Xóa queue, revoke client và disconnect phải có confirmation phù hợp.
- Các nút destructive không nằm sát nút primary.

## 2.3 Progressive disclosure

Mỗi màn chỉ hiển thị độ phức tạp cần thiết:

- Basic mode cho streamer.
- Advanced section cho cooldown, rate limit, priority và matching.
- Developer Mode cho raw JSON, connector payload và low-level metrics.

## 2.4 Real-time without chaos

- Event mới có animation nhẹ, không làm layout nhảy.
- Danh sách event không tự cuộn nếu người dùng đang inspect event cũ.
- Dùng badge và summary thay vì nhấp nháy toàn màn hình.
- Burst event phải được batch hoặc aggregate ở UI.

## 2.5 Contract-aware

UI phải phản ánh chính xác runtime semantics:

- `received` khác `completed`.
- `CONNECTED` khác `RECONNECTING`.
- `ACTIVE` khác `DRAINING`.
- Voice `queued`, `synthesizing`, `ready`, `playing`, `completed`, `failed` là các trạng thái khác nhau.
- Event mock phải được gắn nhãn rõ ràng.

## 2.6 Local-first

- Không dùng ngôn ngữ khiến người dùng hiểu rằng dữ liệu đang được cloud sync.
- Runtime token không được hiển thị tràn lan.
- Các URL browser source được trình bày như local URL.
- Restart server phải có cảnh báo rằng paired client token cũ sẽ mất hiệu lực.

---

# 3. Phạm vi bề mặt sản phẩm

CrowdCircuit có bốn bề mặt UI:

## 3.1 CrowdCircuit Studio

Dashboard chính để:

- Kết nối TikTok.
- Xem event.
- Quản lý game.
- Tạo mapping.
- Quản lý voice.
- Giả lập event.
- Xem diagnostics.
- Quản lý paired clients.

Đây là phạm vi chính của tài liệu.

## 3.2 Game Window

Game riêng, có thể là Phaser/browser game hoặc engine khác.

Studio chỉ:

- Mở game.
- Xem trạng thái.
- Gửi test action.
- Activate/pause/switch.

UI gameplay không nằm trong tài liệu này.

## 3.3 Voice Output Browser Source

Trang tối giản để:

- Nhận audio job.
- Phát audio.
- Hiển thị subtitle tùy chọn.
- Báo playback status.

Không có dashboard controls đầy đủ.

## 3.4 Optional Stream Overlay

Overlay hiển thị:

- Gift gần nhất.
- Viewer name.
- Action.
- Subtitle voice.

Không nằm trong MVP bắt buộc, nhưng design system cần cho phép mở rộng.

---

# 4. Personas

## 4.1 Streamer vận hành cá nhân

Đặc điểm:

- Một người vừa livestream vừa điều khiển phần mềm.
- Không muốn xử lý nhiều khái niệm kỹ thuật.
- Cần thao tác nhanh khi event spam hoặc game lỗi.
- Dùng một màn hình hoặc hai màn hình.

Nhu cầu chính:

- Connect nhanh.
- Quan sát trạng thái.
- Pause/mute/clear.
- Chuyển game.
- Test trước khi LIVE.

## 4.2 Game developer

Đặc điểm:

- Cần inspect normalized event và action.
- Cần test payload.
- Cần xem ACK/result.
- Cần pairing game instance.
- Có thể bật Developer Mode.

Nhu cầu chính:

- Raw JSON.
- Simulator scenario.
- Logs.
- Diagnostics.
- Action schema.
- Copy endpoint/browser source URL.

## 4.3 Operator bán kỹ thuật

Đặc điểm:

- Có thể cấu hình nhiều mapping và template.
- Không trực tiếp viết code.
- Cần export/import profile.
- Cần tránh rule conflict.

Nhu cầu chính:

- Visual rule builder.
- Conflict warning.
- Preview.
- Import/export.
- Safe defaults.

---

# 5. Primary user journeys

## 5.1 First-run journey

```text
Launch CrowdCircuit
        ↓
Welcome
        ↓
System check
        ↓
Create/confirm local admin session
        ↓
Choose TikTok connector
        ↓
Enter TikTok username
        ↓
Connect or skip with Simulator
        ↓
Detect/install demo game
        ↓
Pair Voice Output
        ↓
Run mock gift
        ↓
See game action + hear voice
        ↓
Finish onboarding
```

Onboarding cho phép bỏ qua TikTok connection và dùng Simulator. Đây là lựa chọn quan trọng vì người dùng có thể setup khi chưa LIVE.

## 5.2 Start a live session

```text
Open Studio
    ↓
Overview preflight checklist
    ↓
Connect TikTok
    ↓
Open/pair game
    ↓
Verify Voice Output
    ↓
Run one test event
    ↓
Start interaction
```

## 5.3 Create mapping

```text
Mappings
    ↓
New Mapping
    ↓
Choose trigger
    ↓
Choose game action
    ↓
Map parameters
    ↓
Configure controls
    ↓
Test with sample event
    ↓
Resolve conflicts
    ↓
Save as disabled
    ↓
Enable
```

## 5.4 Handle incident during LIVE

```text
Warning appears
    ↓
Quick action from top bar
    ├── Pause Actions
    ├── Mute Voice
    ├── Clear Queue
    └── Disconnect
        ↓
Open diagnostics/details after show is stable
```

## 5.5 Switch active game

```text
Games
    ↓
Select new game
    ↓
Activate
    ↓
Review pending/in-flight actions
    ↓
Drain and Switch
    ↓
Old game = STOPPED
    ↓
New game = ACTIVE
```

---

# 6. Information architecture

## 6.1 Primary navigation

```text
Overview
Live
  ├── Connection
  └── Events
Games
Mappings
Voice
  ├── Voice Control
  ├── Templates
  └── Pronunciation
Simulator
Diagnostics
Settings
```

MVP sidebar nên giữ tối đa 8 primary destinations:

1. Overview
2. Connection
3. Events
4. Games
5. Mappings
6. Voice
7. Simulator
8. Diagnostics

Settings đặt cuối sidebar.

Templates và Pronunciation dùng tab trong Voice thay vì mục sidebar riêng.

## 6.2 Route map

```text
/
├── /overview
├── /connection
├── /events
│   └── /events/:eventId
├── /games
│   └── /games/:gameId
├── /mappings
│   ├── /mappings/new
│   └── /mappings/:mappingId
├── /voice
│   ├── /voice/control
│   ├── /voice/templates
│   └── /voice/pronunciation
├── /simulator
├── /diagnostics
└── /settings
    ├── /settings/general
    ├── /settings/clients
    └── /settings/developer
```

## 6.3 Navigation state

- Active route có nền accent nhẹ và left indicator.
- Sidebar không tự đóng trên desktop.
- Sidebar compact mode cho màn hình hẹp.
- Badge cảnh báo xuất hiện cạnh:
  - Connection khi reconnect/error.
  - Voice khi queue saturation/failure.
  - Diagnostics khi có critical incident.
- Badge không dùng chỉ màu; luôn có icon hoặc số.

---

# 7. App shell

## 7.1 Desktop layout

```text
┌───────────────────────────────────────────────────────────────────────┐
│ CrowdCircuit   [System status]              [Quick controls] [⋯]    │
├────────────────┬──────────────────────────────────────────────────────┤
│                │ Page title                         Page actions      │
│ Sidebar        ├──────────────────────────────────────────────────────┤
│                │                                                      │
│ Overview       │ Main content                                         │
│ Connection     │                                                      │
│ Events         │                                                      │
│ Games          │                                                      │
│ Mappings       │                                                      │
│ Voice          │                                                      │
│ Simulator      │                                                      │
│ Diagnostics    │                                                      │
│                │                                                      │
│ Settings       │                                                      │
├────────────────┴──────────────────────────────────────────────────────┤
│ CrowdCircuit by MS24 Labs       Local runtime       v0.1.x           │
└───────────────────────────────────────────────────────────────────────┘
```

## 7.2 Top bar

Top bar luôn hiển thị:

- CrowdCircuit logo.
- Global system status.
- TikTok connection compact status.
- Active game compact status.
- Voice compact status.
- Quick controls.
- Overflow menu.

### Global status

Các trạng thái:

| Trạng thái | Hiển thị |
|---|---|
| Ready | Green dot + `Ready` |
| Setup required | Gray dot + `Setup required` |
| Degraded | Amber dot + `Degraded` |
| Paused | Amber pause icon + `Interactions paused` |
| Critical | Red icon + `Action required` |

Click status mở System Status Popover.

### Quick controls

Thứ tự:

1. `Pause Actions` / `Resume Actions`
2. `Mute Voice` / `Unmute Voice`
3. Overflow:
   - Clear Voice Queue
   - Disconnect TikTok
   - Open Diagnostics

Các quick control có tooltip và keyboard shortcut.

## 7.3 Page header

Bao gồm:

- Page title.
- Một câu description ngắn nếu cần.
- Primary action bên phải.
- Breadcrumb chỉ dùng ở editor/detail.

Ví dụ:

```text
Mappings
Convert LIVE events into game actions.              [New Mapping]
```

## 7.4 Footer

Hiển thị nhẹ:

- `CrowdCircuit by MS24 Labs`
- Runtime mode: `Local`
- App version
- Backend health indicator

Không dùng footer để hiển thị lỗi quan trọng.

---

# 8. Design system foundations

## 8.1 Visual direction

Phong cách:

- Light theme.
- Sạch, hiện đại, technical-friendly.
- Không cyberpunk/neon nặng.
- Card và border nhẹ.
- Accent dùng có kiểm soát.
- Status color rõ nhưng không phủ toàn card.

## 8.2 Color tokens

### Core

| Token | Giá trị đề xuất | Mục đích |
|---|---:|---|
| `--color-bg-app` | `#F6F8FB` | Nền ứng dụng |
| `--color-bg-surface` | `#FFFFFF` | Card/panel |
| `--color-bg-subtle` | `#F0F4F8` | Nền phụ |
| `--color-border` | `#D9E1EA` | Border |
| `--color-text-primary` | `#172033` | Text chính |
| `--color-text-secondary` | `#5F6B7A` | Text phụ |
| `--color-text-muted` | `#8792A2` | Metadata |
| `--color-accent` | `#4F6EF7` | Primary action |
| `--color-accent-hover` | `#3E5BDD` | Hover |
| `--color-accent-soft` | `#EEF1FF` | Active nav/highlight |

### Status

| Token | Giá trị đề xuất |
|---|---:|
| Success | `#168A5B` |
| Success soft | `#E9F7F0` |
| Warning | `#B76E00` |
| Warning soft | `#FFF4DE` |
| Danger | `#C73D4D` |
| Danger soft | `#FDECEF` |
| Info | `#2374C6` |
| Info soft | `#EAF4FF` |
| Neutral | `#6B7280` |

Mọi trạng thái phải có icon/text, không dựa duy nhất vào màu.

## 8.3 Typography

Font ưu tiên:

```text
Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif
```

Scale:

| Style | Size | Weight |
|---|---:|---:|
| Display | 28 px | 700 |
| H1 | 24 px | 700 |
| H2 | 20 px | 650 |
| H3 | 16 px | 650 |
| Body | 14 px | 400 |
| Body strong | 14 px | 600 |
| Small | 12 px | 400 |
| Mono | 12–13 px | 400 |

JSON, IDs, endpoints dùng mono font:

```text
"JetBrains Mono", "SFMono-Regular", Consolas, monospace
```

## 8.4 Spacing

Dùng base unit 4 px:

```text
4, 8, 12, 16, 20, 24, 32, 40, 48
```

- Card padding mặc định: 20–24 px.
- Form field gap: 16 px.
- Section gap: 24–32 px.
- Page horizontal padding: 24 px desktop.

## 8.5 Radius

| Component | Radius |
|---|---:|
| Button/input | 8 px |
| Card | 12 px |
| Modal | 14 px |
| Badge | 999 px |
| Code block | 8 px |

## 8.6 Elevation

- Default card: border, không shadow hoặc shadow rất nhẹ.
- Popover/dropdown: medium shadow.
- Modal: stronger shadow + backdrop.
- Không dùng nhiều lớp elevation gây cảm giác mobile app phóng to.

## 8.7 Iconography

- Dùng một bộ icon nhất quán, ví dụ Lucide.
- Size chuẩn: 16, 18, 20, 24 px.
- Icon destructive không thay thế text ở control quan trọng.
- Gift/event icon có thể dùng emoji trong feed MVP, nhưng action/status icon phải dùng icon system.

---

# 9. Core component inventory

## 9.1 Buttons

Variants:

- Primary.
- Secondary.
- Ghost.
- Danger.
- Icon.
- Split button nếu cần test action options.

States:

- Default.
- Hover.
- Focus.
- Disabled.
- Loading.
- Success confirmation ngắn.

Quy tắc:

- Một vùng chỉ có tối đa một primary button.
- Loading button giữ nguyên chiều rộng.
- Destructive button dùng text cụ thể: `Disconnect TikTok`, không dùng `Confirm`.

## 9.2 Status badge

Props:

```ts
type StatusBadgeProps = {
  status: "success" | "warning" | "danger" | "info" | "neutral";
  label: string;
  pulse?: boolean;
  icon?: Icon;
};
```

Pulse chỉ dùng cho:

- Live connected.
- Currently playing.
- Connecting/reconnecting.

Không pulse mọi badge.

## 9.3 Metric card

Hiển thị:

- Label.
- Main value.
- Supporting status.
- Optional sparkline không bắt buộc MVP.
- Click-through destination.

Ví dụ:

```text
Events/min
128
Peak 240
```

## 9.4 Event row

Bao gồm:

- Timestamp.
- Event type icon/badge.
- Viewer avatar/name.
- Event summary.
- Mapping result.
- Voice status.
- Mock badge nếu cần.
- Expand action.

## 9.5 Empty state

Cấu trúc:

- Icon/illustration nhỏ.
- Tiêu đề.
- Mô tả 1–2 câu.
- Một primary action.
- Một secondary link tối đa.

Ví dụ:

```text
No game connected
Open the demo game or pair another game instance.
[Open Demo Game]  Pair manually
```

## 9.6 Banner

Types:

- Info.
- Warning.
- Error.
- Success.

Banner persistent cho:

- Reconnecting.
- Interactions paused.
- Voice output disconnected.
- Active game draining.

Toast chỉ dùng cho confirmation ngắn.

## 9.7 Data table

Dùng cho mappings, clients, logs.

Yêu cầu:

- Sticky header nếu danh sách dài.
- Sort/filter.
- Row actions qua overflow.
- Bulk action hạn chế.
- Skeleton khi loading.
- Empty state trong table body.

## 9.8 Drawer

Dùng cho:

- Event details.
- Quick diagnostics.
- Voice job details.
- Client pairing instructions.

Drawer tránh làm mất context danh sách.

## 9.9 Modal

Chỉ dùng khi:

- Destructive confirmation.
- Switch active game.
- Pair client.
- Import profile.
- Unsaved changes.

Không dùng modal cho form mapping dài; dùng full page editor.

## 9.10 Code/JSON viewer

Có:

- Syntax highlight.
- Copy.
- Word wrap toggle.
- Raw/normalized tabs nếu developer mode.
- Search trong JSON là future enhancement.

---

# 10. Global system states

## 10.1 Preflight state model

Studio tổng hợp health từ:

- Backend.
- Admin WebSocket.
- TikTok connector.
- Active game.
- Voice output.
- Mapping system pause state.

### Ready

Điều kiện:

- Backend healthy.
- Admin WS connected.
- Connector connected hoặc Simulator mode.
- Active game connected.
- Voice output connected nếu voice enabled.
- Interactions not paused.

### Degraded

Ví dụ:

- TikTok connected nhưng voice output offline.
- Game connected nhưng TTS provider lỗi.
- Connector reconnecting.
- Queue gần đầy.
- Một mapping bị auto-disabled.

### Critical

Ví dụ:

- Backend unreachable.
- Admin session invalid.
- Connector permanently failed.
- Active game lost trong khi interactions active.
- SQLite migration failure.

## 10.2 Offline/reconnect UX

Khi admin WebSocket mất:

- Top banner: `Realtime updates disconnected. Reconnecting…`
- Không cho thao tác có nguy cơ gửi lặp nếu request status không xác định.
- REST read có thể tiếp tục nếu backend reachable.
- Khi reconnect:
  - Fetch snapshot lại.
  - Không chỉ dựa vào missed WS events.
  - Toast: `Realtime connection restored`.
- Không replay animation cho event cũ.

## 10.3 Global pause

Khi interactions paused:

- Top bar đổi thành amber.
- Persistent banner:
  - `Game actions are paused. Events are still being received and logged.`
- Mapping editor vẫn cho test ở dry-run.
- Voice có thể hoạt động độc lập tùy setting.
- Nút `Resume Actions` là primary.

---

# 11. First-run onboarding

## 11.1 Mục tiêu

- Giải thích sản phẩm trong tối đa 1 màn.
- Xác nhận backend local hoạt động.
- Thiết lập connector/game/voice.
- Chạy smoke test.
- Không ép người dùng phải LIVE ngay.

## 11.2 Step 1 — Welcome

Nội dung:

```text
Welcome to CrowdCircuit

Turn LIVE events into game actions and voice reactions.

[Set up CrowdCircuit]
```

Secondary:

```text
I’ll configure it manually
```

## 11.3 Step 2 — System check

Checklist:

- Backend running.
- SQLite writable.
- Admin realtime connection.
- Audio playback support.
- Browser source compatibility note.

UI:

```text
System check

✓ Local backend
✓ Realtime connection
✓ Configuration storage
○ Audio output — needs a quick test

[Test audio]
```

Không hiển thị stack trace ở đây. Có `View technical details`.

## 11.4 Step 3 — TikTok connection

Fields:

- Connector.
- TikTok username.
- Optional advanced options collapsed.

Actions:

- `Connect to LIVE`
- `Skip and use Simulator`

Nếu room chưa LIVE:

- Không dùng generic error.
- Hiển thị:
  - `We could not find an active LIVE room for @username.`
  - Cho retry.
  - Cho tiếp tục Simulator.

## 11.5 Step 4 — Game

Options:

- Open Demo Game.
- Pair Existing Game.
- Skip for now.

Demo card mô tả:

```text
Zombie Survival Demo
Supports spawn, boss, heal and team actions.
```

Pair existing game mở pairing drawer:

1. Generate one-time code.
2. Copy code.
3. Show expiration countdown.
4. Show client connection progress.
5. Never expose runtime secret.

## 11.6 Step 5 — Voice output

Options:

- Open Voice Output browser source.
- Copy local URL.
- Test sound.
- Disable voice for now.

Hiển thị hướng dẫn ngắn:

```text
Add this URL as a Browser Source and enable audio capture.
```

## 11.7 Step 6 — Smoke test

Preset:

```text
Test User sends Rose ×5
```

Expected progress:

```text
✓ Mock event created
✓ Mapping matched
✓ Action received by game
✓ Action completed
✓ Voice played
```

Nếu bước nào fail, click mở chi tiết đúng module.

## 11.8 Completion

```text
CrowdCircuit is ready

[Go to Overview]
```

Checkbox tùy chọn:

```text
Open preflight checklist on startup
```

---

# 12. Overview screen

## 12.1 Mục tiêu

Overview là màn vận hành chính, trả lời 5 câu hỏi:

1. TikTok có đang kết nối không?
2. Game nào đang active và còn sống không?
3. Event có đang chảy không?
4. Voice có đang phát/nghẽn không?
5. Tôi cần hành động gì ngay bây giờ?

## 12.2 Layout

```text
┌────────────────────────────────────────────────────────────────────┐
│ Overview                                      [Run Preflight Test] │
├────────────────────────────────────────────────────────────────────┤
│ System health banner / preflight summary                           │
├─────────────────┬─────────────────┬─────────────────┬───────────────┤
│ TikTok LIVE     │ Active Game     │ Events/min      │ Voice Queue   │
│ Connected       │ Zombie Survival │ 128             │ 3 waiting     │
│ @username       │ Connected       │ Peak 240        │ Playing...    │
├─────────────────────────────────────┬──────────────────────────────┤
│ Recent Activity                     │ Quick Controls               │
│ event feed                           │ Pause / Mute / Clear / Test  │
├─────────────────────────────────────┼──────────────────────────────┤
│ Action Health                        │ Setup / Warnings             │
│ received/completed/failed summary    │ actionable cards             │
└─────────────────────────────────────┴──────────────────────────────┘
```

## 12.3 System health banner

Ready:

```text
All systems ready for interaction.
TikTok, game and voice output are connected.
```

Degraded:

```text
Voice output is disconnected.
Game actions are still active. [Reconnect Voice Output]
```

Không dùng banner xanh khi mọi thứ bình thường nếu làm tốn không gian; có thể dùng compact preflight strip.

## 12.4 Status cards

### TikTok LIVE card

Hiển thị:

- Status.
- Username.
- Uptime.
- Last event.
- Reconnect count nếu > 0.
- Action `Manage connection`.

### Active Game card

Hiển thị:

- Game name.
- Game lifecycle state.
- Instance ID rút gọn.
- Last heartbeat.
- Pending/in-flight action.
- Action `Open game`.

### Events card

Hiển thị:

- Events/min.
- Breakdown gift/comment.
- Mock event ratio nếu > 0.
- Action `View events`.

### Voice card

Hiển thị:

- Enabled/muted.
- Playing sentence rút gọn.
- Queue length.
- Failed jobs.
- Action `Open voice`.

## 12.5 Recent Activity

Mặc định 10 item gần nhất.

Một row ví dụ:

```text
10:24:01  Gift  Minh sent Rose ×5
           SPAWN_ZOMBIE ×5 · completed
           Voice · playing
```

Mock event:

```text
TEST
10:24:01  Gift  Test User sent Rose ×5
```

## 12.6 Quick controls

Buttons:

- Pause Actions.
- Mute Voice.
- Clear Voice Queue.
- Test Gift.
- Open Game.
- Diagnostics.

`Clear Voice Queue` yêu cầu confirmation nếu queue > 0:

```text
Clear 8 queued voice messages?
The message currently playing will not be interrupted.
```

## 12.7 Empty states

Chưa connect TikTok:

```text
TikTok LIVE is not connected
Connect a LIVE room or use the Simulator.
[Connect TikTok] [Open Simulator]
```

Chưa game:

```text
No active game
Activate the demo game or pair another game.
[Open Games]
```

---

# 13. Connection screen

## 13.1 Mục tiêu

- Cấu hình và điều khiển connector.
- Hiển thị connection health.
- Cho phép debug vừa đủ.

## 13.2 Layout

```text
Connection                                      [Connect / Disconnect]

┌─────────────────────────────────────────────────────────────────┐
│ TikTok LIVE                                                     │
│ Username        Connector                                       │
│ @username       TikTok Live Connector                           │
│ Status: Connected                                               │
└─────────────────────────────────────────────────────────────────┘

┌────────────────────────────┬────────────────────────────────────┐
│ Session                    │ Connection Health                  │
│ Room ID                    │ Last event                         │
│ Uptime                     │ Reconnect attempts                 │
│ Connected at               │ Last error                         │
└────────────────────────────┴────────────────────────────────────┘

[Advanced diagnostics]
```

## 13.3 Connect form

Fields:

- `TikTok username`
  - Prefix `@` visually.
  - Trim spaces.
  - Không yêu cầu user nhập `@`.
- `Connector`
  - TikTok Live Connector.
  - TikFinity khi implementation có.
  - Mock không đặt trong production connector selector; Simulator xử lý mock.

Validation:

- Required.
- Allowed characters.
- Max length.
- Inline error.

## 13.4 Connection state UX

### Connecting

- Button loading: `Connecting…`
- Disable editing username.
- Show status timeline.
- Cancel optional nếu connector hỗ trợ.

### Connected

- Primary action đổi thành `Disconnect`.
- Show room information.
- Show green compact badge.
- Save last successful username.

### Reconnecting

Persistent warning banner:

```text
Connection lost. Reconnecting in 5 seconds…
Attempt 2 · [Retry now] [Disconnect]
```

Event feed không xóa.

### Live ended

```text
The LIVE session has ended.
Events are no longer being received.
[Reconnect] [Open Simulator]
```

### Error

Hiển thị human-readable message và technical details collapsed.

Ví dụ:

```text
Could not connect to @username
No active LIVE room was found.
```

## 13.5 Disconnect confirmation

Nếu interactions active:

```text
Disconnect TikTok LIVE?

New LIVE events will stop. The game and voice output will remain connected.
[Cancel] [Disconnect TikTok]
```

Không cần confirmation nếu chưa connected.

## 13.6 Diagnostics panel

Hiển thị:

- Connector package/version.
- Room ID.
- Last heartbeat/event.
- Event rate.
- Reconnect history.
- Last normalized event ID.
- Copy diagnostics.

Raw connector error chỉ trong Developer Mode.

---

# 14. Events screen

## 14.1 Mục tiêu

- Theo dõi event real-time.
- Inspect event normalized.
- Biết event đã tạo action/voice gì.
- Replay event dưới dạng mock.

## 14.2 Toolbar

```text
[All] [Gifts] [Comments] [Social] [Likes]     Search
[Live tail: ON] [Pause view] [Filters] [Clear local view]
```

`Pause view` chỉ dừng cập nhật UI, không dừng backend/event processing.

Khi paused:

```text
View paused · 34 new events
[Resume and jump to latest]
```

## 14.3 Event table/feed columns

- Time.
- Type.
- Viewer.
- Summary.
- Mapping.
- Action status.
- Voice status.
- Source.
- Expand.

## 14.4 Event details drawer

Tabs:

1. Summary.
2. Normalized JSON.
3. Actions.
4. Voice.
5. Raw connector data — Developer Mode only.

Summary:

- Event ID.
- Occurred/received timestamps.
- Viewer.
- Gift/comment.
- Dedup/aggregation metadata.
- Mapping results.

Actions tab:

```text
SPAWN_ZOMBIE
Status: completed
Received: 220 ms
Completed: 2.8 s
Mapping: Rose spawns zombie
```

Voice tab:

```text
Thank gift
Status: playing
Template: gift.default
Text: ...
```

Actions:

- Copy normalized JSON.
- Replay as mock.
- Open mapping.
- Copy event ID.

## 14.5 Event source badge

- `LIVE`
- `MOCK`
- `REPLAY`

Replay as mock phải tạo event ID mới và giữ metadata `replayedFromEventId`.

## 14.6 Burst handling

Nếu > 20 like updates/giây:

- UI aggregate row:
  - `+1,240 likes in 1s`
- Không render từng like.

Nếu gift streak đang mở:

```text
Rose ×17 · combo active
```

Sau finalization:

```text
Rose ×23 · combo ended by inactivity timeout
```

Technical end reason chỉ hiện trong detail.

---

# 15. Games screen

## 15.1 Mục tiêu

- Xem game đã đăng ký.
- Activate game.
- Pair game instance.
- Test action.
- Theo dõi action health.

## 15.2 Game list

Card/list item:

- Icon/thumbnail.
- Game name.
- Version.
- Lifecycle status.
- Number of actions.
- Active badge.
- Instance count.
- Last heartbeat.
- Actions.

Example:

```text
Zombie Survival                         ACTIVE
Version 0.1.0 · SDK 0.1
Connected · 8 supported actions
[Open Game] [Manage]
```

## 15.3 Game details

Sections:

- Overview.
- Instances.
- Supported actions.
- Action health.
- Default profile.

### Supported action row

```text
SPAWN_ZOMBIE
Spawn zombies owned by a viewer
amount: integer 1–100
ownerName: string
[Test]
```

Test action mở inline form tạo từ manifest schema.

## 15.4 Pair game

Drawer:

```text
Pair a game instance

1. Generate a one-time pairing code
2. Enter it in the CrowdCircuit SDK client
3. Wait for the connection

Code: 482 917
Expires in 04:32

[Copy Code] [Generate New Code]
```

Khi paired:

```text
Game connected
Zombie Survival · instance a1b2c3
```

## 15.5 Active game switch

Modal:

```text
Switch active game?

Current: Zombie Survival
New: Team Battle

3 actions are waiting for receipt.
1 action is being processed by the current game.

Switch mode
● Drain and switch
  Stop sending new actions, wait up to 5 seconds for pending receipts.
○ Cancel pending and switch now
  Pending actions will be marked cancelled.

Voice messages
☑ Drop queued messages linked only to the old game

[Cancel] [Drain and Switch]
```

Default: Drain and switch.

Progress state:

```text
Switching games…
1. Pausing mappings ✓
2. Draining old game actions 2/3
3. Activating Team Battle
```

## 15.6 Game disconnected during LIVE

Banner:

```text
Active game disconnected
New game actions are paused automatically.
[Reconnect Game] [Switch Game]
```

Không tự gửi action dồn dập sau reconnect nếu đã hết TTL.

---

# 16. Mappings screen

## 16.1 Mục tiêu

Mappings là công cụ cấu hình mạnh nhất nhưng phải dùng được mà không sửa JSON.

Hai bề mặt:

- Mapping list.
- Mapping editor.

## 16.2 Mapping list

Columns:

- Enabled.
- Name.
- Trigger.
- Action.
- Priority.
- Match mode/group.
- Rate limit.
- Last matched.
- Health.
- Actions menu.

Toolbar:

- New Mapping.
- Search.
- Filter event type.
- Filter enabled.
- Import/export profile.
- Bulk enable/disable — future if complexity grows.

Row example:

```text
● Rose spawns zombie
Gift: Rose × quantity
→ SPAWN_ZOMBIE
Priority 100 · 120/min
Last matched 3s ago
```

Warnings:

- Conflict.
- Invalid action schema.
- Missing game.
- Auto-disabled after errors.

## 16.3 Mapping editor layout

Desktop three-panel:

```text
┌─────────────────────────┬─────────────────────────┬──────────────────┐
│ Trigger                 │ Action                  │ Test & Preview   │
│ event + conditions      │ type + parameters       │ sample event     │
│                         │ controls                │ output/conflict  │
└─────────────────────────┴─────────────────────────┴──────────────────┘
```

Ở màn nhỏ, chuyển thành stepper/tab:

1. Trigger.
2. Action.
3. Controls.
4. Test.

## 16.4 Mapping metadata

Fields:

- Name.
- Description optional.
- Enabled.
- Priority.
- Tags future.

New mapping defaults:

- Enabled = false.
- Priority = 100.
- `matchMode` inherited from profile.
- No rate limit override unless needed.

## 16.5 Trigger builder

### Event type

Select:

- Gift sent.
- Comment.
- Follow.
- Share.
- Like milestone.
- Viewer joined.
- Subscription nếu connector hỗ trợ.

### Conditions

Visual rows:

```text
[Field] [Operator] [Value] [Remove]
```

Examples:

```text
Gift ID        equals       rose
Quantity       greater/equal 1
Comment text   equals       team đỏ
```

Add condition.

Advanced conditions collapsed:

- Regex.
- Role.
- Diamond value.
- Streak status.
- Source.

Regex field phải có:

- Validation.
- Test input.
- Warning về complexity.
- Không cho catastrophic regex nếu backend validator reject.

## 16.6 Action builder

Select game action từ active game manifest.

Khi đổi action:

- Parameter form generate từ schema.
- Không giữ parameter incompatible.
- Confirm nếu mất dữ liệu.

### Parameter mapping modes

Mỗi parameter có:

- Static value.
- Event variable.
- Template expression.

Example:

```text
amount
● From event: payload.quantity
○ Static: 1

ownerName
● From event: user.displayName
```

Advanced template:

```text
{{payload.quantity}}
```

UI nên ưu tiên dropdown variable, không bắt user gõ path.

## 16.7 Controls

Fields:

- Cooldown.
- Max actions/minute.
- Per-user limit.
- Priority.
- Aggregation window.
- Probability — advanced.
- Action TTL.
- Exclusive group.

Hiển thị effective limits:

```text
This rule: 120/min
Game global budget: 30/s, burst 50
```

## 16.8 Match policy

Profile-level setting:

```text
When multiple rules match
● Run all matching rules
○ Run first matching rule
○ Use exclusive groups
```

Trong editor:

- Show effective order.
- Show specificity score read-only trong Developer Mode.
- Tie-break preview:

```text
Execution order
1. Rose spawns boss · priority 120
2. Rose leaderboard points · priority 100
```

## 16.9 Conflict detection

Test panel hiển thị:

```text
2 rules match this event

✓ Rose spawns zombie
⚠ Rose generic gift effect

Both will run because profile mode is “Run all”.
```

Nếu exclusive group:

```text
Only “Rose spawns zombie” will run.
Reason: higher priority.
```

## 16.10 Test workflow

User chọn:

- Example event auto-generated.
- Paste normalized event.
- Select recent event.
- Create custom mock event.

Kết quả:

```text
MATCHED
Action: SPAWN_ZOMBIE

Resolved payload
{
  "amount": 5,
  "ownerName": "Test User"
}

Delivery
○ Dry run only
● Send to connected game
```

Default = Dry run.

## 16.11 Save behavior

- Autosave không áp dụng cho mapping MVP.
- Unsaved indicator.
- Navigate away → confirmation.
- Save validates.
- Sau save disabled mapping:
  - Toast `Mapping saved`.
  - CTA `Enable mapping`.
- Mapping chưa test vẫn cho save nhưng cảnh báo.

---

# 17. Voice screen

Voice có ba tab:

1. Control.
2. Templates.
3. Pronunciation.

---

## 17.1 Voice Control

### Layout

```text
┌────────────────────────────────┬──────────────────────────────────┐
│ Voice settings                 │ Queue                            │
│ provider/voice/tone            │ now playing + upcoming           │
├────────────────────────────────┼──────────────────────────────────┤
│ Test voice                     │ Recent failures                  │
└────────────────────────────────┴──────────────────────────────────┘
```

### Settings

- Enable voice.
- Provider.
- Voice.
- Rate.
- Pitch.
- Volume.
- Tone.
- Interrupt policy.
- Queue cap.
- Subtitle output optional.

Interrupt options:

- Never interrupt.
- Interrupt lower priority.
- Interrupt any.

Mỗi option có mô tả rõ.

### Provider health

```text
Edge TTS
Healthy · last check 10s ago
```

Nếu provider lỗi:

```text
TTS provider unavailable
Game actions are not affected.
[Retry] [Choose another provider]
```

### Now Playing

Hiển thị:

- Text.
- Kind.
- Priority.
- Viewer.
- Progress.
- Stop button chỉ nếu interrupt policy/implementation hỗ trợ.

### Queue list

Columns:

- Position.
- Priority.
- Text.
- Type.
- Age.
- Status.
- Remove.

Queue saturation:

- 70%: warning compact.
- 90%: persistent warning.
- 100%: show drop policy summary.

### Clear queue

Options:

```text
Clear queued voice messages

☑ Keep the message currently playing
○ Stop current playback too

[Cancel] [Clear Queue]
```

Default keep current playback.

## 17.2 Voice test

Fields:

- Text.
- Voice profile.
- Priority.
- Play locally.
- Add to queue.

Default text:

```text
CrowdCircuit voice output is working.
```

Không dùng viewer comment raw làm default.

---

# 18. Templates tab

## 18.1 Template list

Group by:

- Gift default.
- Gift gameplay.
- Follow.
- Game commentary.
- System.

Columns:

- Template.
- Tone.
- Weight.
- Enabled.
- Last used.

## 18.2 Template editor

Fields:

- Group.
- Tone.
- Template text.
- Weight.
- Enabled.
- Variables.

Variable picker:

- `{name}`
- `{count}`
- `{giftName}`
- `{actionName}`
- `{team}`

Validation:

- Unknown variable.
- Empty template.
- Too long.
- Disallowed markup.
- Potentially unsafe content.

## 18.3 Preview

Preview data editable:

```text
name: Quang Minh
count: 5
giftName: bông hồng
```

Output:

```text
Cảm ơn Quang Minh đã tặng 5 bông hồng nhé!
```

Buttons:

- Generate another sample.
- Test voice.
- Save.

## 18.4 Import/export

Import modal:

- Select JSON.
- Preview changes.
- Conflict policy:
  - Skip.
  - Replace.
  - Duplicate.
- Validate before apply.

Export:

- Current tone.
- All templates.
- Include pronunciation rules optional.

---

# 19. Pronunciation tab

## 19.1 Rule list

Columns:

- Match type.
- Pattern.
- Read as.
- Priority.
- Enabled.
- Last matched.

Match types:

- Exact.
- Contains.
- Regex.
- Fallback.

## 19.2 Add rule

Example:

```text
When name exactly matches:
dquangminh_2k6

Read as:
Quang Minh
```

Actions:

- Preview normalization.
- Test voice.
- Save.

## 19.3 Name safety preview

Hiển thị pipeline:

```text
Original      dquangminh_2k6
Normalized    dquangminh 2k6
Rule match    Quang Minh
Final speech  Quang Minh
```

Nếu fallback:

```text
Final speech: một vị đại ca
Reason: name contains a blocked term
```

Không hiển thị blocked term công khai trên stream.

---

# 20. Simulator screen

## 20.1 Mục tiêu

Simulator là công cụ kiểm thử first-class, không phải dev-only hidden page.

Nó phải test được:

- Event normalization.
- Mapping.
- Action delivery.
- Voice.
- Reconnect/error scenario.

## 20.2 Layout

```text
┌─────────────────────────────┬────────────────────────────────────┐
│ Event Builder               │ Pipeline Result                    │
│ type/user/payload           │ normalize → map → action → voice  │
├─────────────────────────────┼────────────────────────────────────┤
│ Presets / scenarios         │ Timeline / logs                    │
└─────────────────────────────┴────────────────────────────────────┘
```

## 20.3 Event Builder

Tabs:

- Gift.
- Comment.
- Social.
- Like.
- Custom JSON.

Gift fields:

- User display name.
- User ID optional.
- Gift ID.
- Gift name.
- Quantity.
- Diamond value optional.
- Streak status.
- Source badge fixed `MOCK`.

Comment fields:

- Text.
- User.
- Repeat count.
- Interval.

## 20.4 Emit controls

- Emit once.
- Emit burst.
- Dry-run.
- Send through full pipeline.

Burst config:

- Count.
- Interval.
- User mode:
  - Same user.
  - Random users.
- Confirm if count > 100.

## 20.5 Scenarios

MVP presets:

1. Normal gift flow.
2. Gift combo.
3. Gift missing `END`.
4. Duplicate event.
5. Comment spam.
6. High-value gift.
7. Like milestone.
8. Active game disconnect.
9. Game reconnect.
10. Voice queue saturation.
11. Connector reconnect.
12. Switch active game with in-flight actions.

## 20.6 Pipeline timeline

Example:

```text
10:30:00.000 Mock event created
10:30:00.006 Normalized
10:30:00.008 Dedup passed
10:30:00.011 Mapping matched: Rose spawns zombie
10:30:00.018 Action sent
10:30:00.041 Action received
10:30:02.860 Action completed
10:30:03.021 Voice playing
```

Failures link tới đúng module.

---

# 21. Diagnostics screen

## 21.1 Mục tiêu

- Hiển thị health mà không yêu cầu đọc terminal.
- Tạo diagnostic bundle.
- Hỗ trợ dev inspect.
- Không làm lộ secret.

## 21.2 Health overview

Cards:

- Backend.
- Database.
- Admin WebSocket.
- Connector.
- Active game.
- Voice provider.
- Voice output.
- Media cache.

Mỗi card:

- Status.
- Last check.
- Latency.
- Last error.
- Suggested action.

## 21.3 Metrics

Endpoint nguồn:

```text
GET /api/v1/diagnostics/metrics
```

MVP hiển thị JSON-derived metrics:

- Events received.
- Events dropped.
- Duplicate events.
- Mapping matches.
- Action receipt latency.
- Action completion latency.
- Action failures.
- Voice queue length.
- Voice failures.
- Reconnect count.

Không cần Prometheus graph dashboard trong MVP.

## 21.4 Logs

Filters:

- Severity.
- Module.
- Time.
- Correlation ID.
- Search text.

Columns:

- Timestamp.
- Level.
- Module.
- Message.
- Correlation ID.

Detail drawer có structured fields.

## 21.5 Diagnostic bundle

Button:

```text
Download diagnostic bundle
```

Modal mô tả:

Included:

- Recent masked logs.
- App/backend version.
- Connector version.
- System health snapshot.
- Metrics snapshot.
- Config schema version.

Excluded:

- Runtime secret.
- Role tokens.
- TikTok cookies/password.
- Full unmasked personal data.

## 21.6 Developer Mode

Toggle trong Settings.

Khi bật:

- Raw connector event.
- Specificity score.
- WebSocket event inspector.
- Internal IDs.
- Advanced metrics.

Có warning:

```text
Developer Mode exposes technical data and may reduce readability.
```

---

# 22. Settings screen

## 22.1 General

- Start page.
- Open preflight on launch.
- Confirm destructive actions.
- Retain event log duration.
- Language future.
- Theme: Light fixed trong v0.1; System/Dark future.

## 22.2 Paired clients

Data table:

- Client name.
- Role.
- Instance/game.
- Paired at.
- Last seen.
- Status.
- Revoke.

Actions:

- Pair new game.
- Pair voice output.
- Revoke all non-admin clients.

Revoke confirmation:

```text
Revoke all paired clients?

Games and voice outputs must pair again.
The dashboard admin session will remain active.
```

## 22.3 Runtime session

Hiển thị:

- Runtime started at.
- Session duration.
- Notice:
  - `Restarting the backend invalidates all paired client tokens.`

Không hiển thị runtime secret.

## 22.4 Developer

- Developer Mode.
- Raw event retention.
- Verbose logging.
- Reset local configuration.
- Open data directory.

Reset config là destructive và yêu cầu typed confirmation:

```text
Type RESET to continue
```

---

# 23. Pairing UX

## 23.1 Pairing code lifecycle

UI phải phản ánh:

- One-time.
- Role-bound.
- Loopback-only.
- Expiration countdown.
- Used/expired state.

## 23.2 Pairing state

```text
GENERATING
    ↓
AVAILABLE
    ├── USED → SUCCESS
    └── EXPIRED
```

## 23.3 Pairing code presentation

- Format 6 digits nhóm 3:
  - `482 917`
- Copy button.
- Countdown.
- Không render token.
- Generate new invalidates old code.

## 23.4 Pairing failure messages

- Invalid code.
- Expired code.
- Wrong role.
- Client already paired.
- Backend restarted.

Mỗi message có recovery action.

---

# 24. Notifications

## 24.1 Toast

Dùng cho:

- Mapping saved.
- Voice test queued.
- Event copied.
- Pairing code copied.
- Client revoked.
- Connection restored.

Không dùng toast cho:

- Connector disconnected.
- Active game lost.
- Voice output offline.
- Interactions paused.

Các trạng thái này cần banner/persistent status.

## 24.2 Notification center

Không bắt buộc MVP. Diagnostics log đủ cho lịch sử.

## 24.3 Sound notification

Studio không phát notification sound mặc định để tránh lọt vào livestream. Voice output là luồng âm thanh duy nhất có chủ đích.

---

# 25. Loading, empty và error states

## 25.1 Loading

- Initial app: branded skeleton, không spinner trống.
- Table: row skeleton.
- Button request: inline spinner.
- Realtime snapshot: giữ data cũ với `Updating…`, không clear màn.

## 25.2 Empty

Mỗi empty state phải có next action.

Không dùng:

```text
No data
```

Nên dùng:

```text
No LIVE events yet
Events will appear here after the connector receives them.
[Open Simulator]
```

## 25.3 Inline error

Form error đặt ngay dưới field.

## 25.4 Page error

Nếu một page API fail nhưng app shell còn sống:

```text
Could not load mappings
The backend returned an error.
[Retry] [Open Diagnostics]
```

## 25.5 Fatal error

Backend unavailable:

```text
CrowdCircuit backend is unavailable

The Studio cannot reach the local service at 127.0.0.1:3100.
[Retry Connection] [View Setup Help]
```

---

# 26. Real-time interaction rules

## 26.1 Snapshot + stream

Mỗi real-time page phải:

1. Fetch initial snapshot qua REST.
2. Subscribe WebSocket.
3. Apply incremental events.
4. Sau reconnect, refetch snapshot.
5. Dedupe update theo ID.

## 26.2 Event ordering

- Hiển thị theo `receivedAt`.
- Detail vẫn show `occurredAt`.
- Nếu event đến trễ, có badge `Late`.
- Không reorder row mạnh khi user đang inspect.

## 26.3 Optimistic UI

Chỉ dùng optimistic update cho:

- Enable/disable simple setting nếu rollback rõ.
- Mute/unmute.
- Pause/resume.

Không dùng optimistic cho:

- Activate game.
- Connect TikTok.
- Delete mapping.
- Revoke client.
- Clear queue.

## 26.4 Stale status

Nếu không nhận heartbeat trong ngưỡng:

```text
Status uncertain
Last update 12 seconds ago
```

Không đổi thẳng sang disconnected nếu backend contract chưa xác nhận.

---

# 27. API mapping

Base:

```text
http://127.0.0.1:3100/api/v1
```

## 27.1 Authentication

| UI action | API |
|---|---|
| Generate pairing code | `POST /auth/pairing-codes` |
| Pair client | `POST /auth/pair` |
| List clients | `GET /auth/clients` |
| Revoke client | `DELETE /auth/clients/:clientId` |
| Revoke non-admin | `POST /auth/revoke-all-non-admin` |

Dashboard admin dùng same-origin cookie + CSRF. Frontend không đọc token từ cookie.

## 27.2 Connection

| UI action | API |
|---|---|
| Connect | `POST /connectors/tiktok/connect` |
| Disconnect | `POST /connectors/tiktok/disconnect` |
| Load status | `GET /connectors/tiktok/status` |

## 27.3 Events

| UI action | API |
|---|---|
| Load event history | `GET /events` |
| Emit mock event | `POST /events/mock` |

Event details endpoint chưa được system design tách riêng; frontend có thể dùng local store từ event list hoặc backend agent bổ sung contract trong phiên bản sau. Không tự giả định endpoint `/events/:id` trước khi backend chốt.

## 27.4 Games

| UI action | API |
|---|---|
| List games | `GET /games` |
| Game details | `GET /games/:gameId` |
| Activate | `POST /games/:gameId/activate` |
| Pause | `POST /games/:gameId/pause` |
| Test action | `POST /games/:gameId/test-action` |

Active-game transition options phải nằm trong request body theo backend contract khi implement; frontend và backend agent phải chốt schema trước Milestone 3.

## 27.5 Mappings

| UI action | API |
|---|---|
| List | `GET /mappings` |
| Create | `POST /mappings` |
| Update | `PUT /mappings/:id` |
| Delete | `DELETE /mappings/:id` |
| Test | `POST /mappings/:id/test` |

## 27.6 Voice

| UI action | API |
|---|---|
| Load settings | `GET /voice/settings` |
| Save settings | `PUT /voice/settings` |
| Queue | `GET /voice/queue` |
| Clear queue | `POST /voice/queue/clear` |
| Test voice | `POST /voice/test` |

## 27.7 Templates/pronunciation

Theo System Design:

```text
GET/POST/PUT/DELETE /voice/templates
GET/POST/PUT/DELETE /voice/pronunciations
```

## 27.8 System

| UI action | API |
|---|---|
| Health | `GET /health` |
| Diagnostics | `GET /diagnostics` |
| Metrics | `GET /diagnostics/metrics` |
| Pause | `POST /system/pause` |
| Resume | `POST /system/resume` |

---

# 28. WebSocket mapping

Admin WebSocket:

```text
/ws/admin
```

Events:

| Server event | UI consumers |
|---|---|
| `system.status` | App shell, Overview |
| `connector.status` | Top bar, Connection, Overview |
| `live.event` | Events, Overview |
| `game.status` | Top bar, Games, Overview |
| `game.action` | Games, Events, Overview |
| `voice.queue` | Top bar, Voice, Overview |
| `log.entry` | Diagnostics |

## 28.1 Admin socket UI indicator

Không hiển thị socket internals cho user thường.

Status mapping:

- Connected → hidden/healthy.
- Reconnecting → top warning.
- Failed → critical banner.

---

# 29. Accessibility

## 29.1 Target

MVP hướng tới WCAG 2.1 AA ở các luồng chính.

## 29.2 Keyboard

- Toàn bộ navigation dùng keyboard.
- Visible focus ring.
- Modal trap focus.
- `Esc` đóng drawer/modal nếu không có destructive progress.
- Shortcut đề xuất:
  - `Ctrl/Cmd + K`: command palette future hoặc navigation.
  - `Shift + P`: Pause/Resume actions.
  - `Shift + M`: Mute/Unmute voice.
- Shortcut khẩn cấp phải tránh trùng browser/system.

## 29.3 Screen reader

- Status badge có accessible label.
- Live regions:
  - Không announce mọi event.
  - Chỉ announce critical status changes.
- Table header semantic.
- Form label đầy đủ.
- Icon button có aria-label.

## 29.4 Color and contrast

- Text contrast AA.
- Status không chỉ dùng màu.
- Focus ring rõ.
- Disabled state vẫn phân biệt được nhưng không quá mờ.

## 29.5 Motion

- Tôn trọng `prefers-reduced-motion`.
- Event entry animation tối đa 150–200 ms.
- Không dùng flashing.
- Pulse status nhẹ, disable khi reduced motion.

---

# 30. Responsive behavior

CrowdCircuit Studio là desktop-first.

## 30.1 Supported viewport

MVP primary:

- 1366×768 trở lên.
- Tối ưu 1440×900 và 1920×1080.

Minimum usable:

- 1024×720.

Mobile không phải target vận hành MVP.

## 30.2 Breakpoints

| Breakpoint | Behavior |
|---|---|
| ≥ 1440 | Full sidebar, multi-column |
| 1200–1439 | Full sidebar, compact gaps |
| 1024–1199 | Collapsible sidebar, panels stack |
| < 1024 | Read-only warning hoặc limited layout |

## 30.3 Page-specific

- Overview: 4 cards → 2×2.
- Mapping editor: 3 columns → step tabs.
- Voice: 2 columns → stacked.
- Event detail: drawer full width hơn.
- Tables: horizontal scroll, không bóp text không đọc được.

---

# 31. Content design

## 31.1 Tone

- Rõ ràng.
- Bình tĩnh.
- Không đổ lỗi user.
- Ít jargon ở default mode.
- Technical term có giải thích ngắn.

## 31.2 Labels

Ưu tiên động từ cụ thể:

- `Connect TikTok`
- `Activate Game`
- `Test Mapping`
- `Clear Voice Queue`

Tránh:

- `Submit`
- `Execute`
- `Proceed`
- `OK`

## 31.3 Error copy format

```text
What happened
Why it matters
What the user can do
```

Ví dụ:

```text
Active game disconnected

New game actions have been paused to prevent them from being lost.
Reconnect the game or activate another game.
```

## 31.4 Technical detail

Technical detail collapsed:

```text
Error code: CONNECTOR_ROOM_NOT_FOUND
Correlation ID: ...
```

---

# 32. Frontend state architecture guidance

Đây không phải bắt buộc framework-level, nhưng giúp agent không trộn state.

## 32.1 State categories

### Server state

- Connector status.
- Events.
- Games.
- Mappings.
- Voice queue/settings.
- Diagnostics.

Dùng TanStack Query hoặc tương đương.

### Realtime state

- WebSocket connection.
- Incremental event feed.
- Live status.
- Queue updates.

### Local UI state

- Drawer/modal.
- Filters.
- Unsaved form.
- Developer Mode display preferences.

### Ephemeral form state

- Mapping editor.
- Simulator builder.
- Template preview.

## 32.2 Suggested stack

Theo System Design:

- React.
- Vite.
- TypeScript.
- TanStack Query.
- React Hook Form.
- Zod shared schema nếu package contract hỗ trợ.
- Socket.IO client.
- Component primitives có accessibility tốt.

## 32.3 Shared contracts

Frontend import type/schema từ:

```text
@crowdcircuit/contracts
```

Không copy-paste schema riêng.

---

# 33. Performance UX

## 33.1 Event feed virtualization

Dùng virtualization khi event list > 200 rows.

## 33.2 Update batching

- Batch UI update trong burst.
- Không set state từng like.
- Giữ 500–1.000 event trong client memory tùy performance.
- Lịch sử dài fetch server.

## 33.3 Perceived performance

- Snapshot skeleton.
- Keep previous data.
- Local validation tức thời.
- Mapping test feedback dưới 300 ms nếu dry-run local.

---

# 34. Security UX

## 34.1 Secret handling

- Không hiển thị runtime secret.
- Không log role token.
- Pairing code chỉ hiển thị trong pairing dialog.
- Copy pairing code có toast, không auto-copy.

## 34.2 Origin warning

Nếu dashboard không chạy same-origin production:

```text
Untrusted dashboard origin
Admin actions are disabled.
```

Dev mode whitelist phải do backend config.

## 34.3 Personal data

Event feed hiển thị viewer name/avatar cần:

- Rolling retention.
- Clear log option.
- Diagnostic export mask.
- Không khẳng định dữ liệu cloud sync.

---

# 35. MVP scope

## 35.1 Must-have screens

- Onboarding.
- Overview.
- Connection.
- Events.
- Games.
- Mappings list/editor.
- Voice Control.
- Templates.
- Pronunciation.
- Simulator.
- Diagnostics.
- Settings/clients.

## 35.2 Must-have components

- App shell.
- Status badge.
- Health banner.
- Event row/detail drawer.
- Game card.
- Mapping builder.
- Voice queue.
- Pairing dialog.
- Mock event builder.
- JSON viewer.
- Confirmation modal.
- Toast system.

## 35.3 Out of scope v0.1

- Dark mode.
- Mobile controller.
- Cloud account.
- Multi-tenant.
- Drag-and-drop node graph mapping.
- Marketplace.
- AI-generated templates.
- Full analytics dashboard.
- Custom dashboard widgets.
- Multi-language UI.
- Collaborative editing.
- Remote access outside loopback.
- Rich overlay designer.

---

# 36. Frontend implementation milestones

## Milestone UI-1 — Shell and Connection

Deliverables:

- App shell.
- Routing.
- Global status.
- Admin session bootstrap.
- Connection page.
- Realtime reconnect banner.
- Basic error boundary.

Acceptance:

- Dashboard loads from local backend.
- Connect/disconnect works.
- Status updates through WS.
- Backend offline state is clear.

## Milestone UI-2 — Events and Overview

Deliverables:

- Overview cards.
- Recent activity.
- Event feed.
- Event detail drawer.
- Filters.
- Mock badge.

Acceptance:

- Events appear real-time.
- Pause view does not pause backend.
- Reconnect refetches snapshot.
- Mock events visibly distinct.

## Milestone UI-3 — Games and Pairing

Deliverables:

- Game list/detail.
- Pairing drawer.
- Test action.
- Active-game switch modal.
- Lifecycle statuses.

Acceptance:

- Pair code lifecycle visible.
- Game heartbeat status updates.
- Drain and Switch UX implemented.
- Action received/result displayed separately.

## Milestone UI-4 — Mapping Builder

Deliverables:

- Mapping list.
- Trigger builder.
- Action schema form.
- Controls.
- Conflict preview.
- Dry-run test.

Acceptance:

- User creates Rose → Spawn Zombie without JSON.
- Invalid payload blocked.
- Multiple-rule match is explained.
- New mapping defaults disabled.

## Milestone UI-5 — Voice

Deliverables:

- Voice settings.
- Queue.
- Templates.
- Pronunciation.
- Voice test.
- Queue saturation states.

Acceptance:

- User hears test voice.
- Queue updates real-time.
- Interrupt mode configurable.
- Pronunciation preview works.

## Milestone UI-6 — Simulator and Diagnostics

Deliverables:

- Event builder.
- Scenario presets.
- Pipeline timeline.
- Health cards.
- Metrics.
- Logs.
- Diagnostic bundle.

Acceptance:

- Gift combo timeout scenario visible.
- Duplicate event scenario shows dedup.
- Game disconnect scenario displays automatic pause.
- Export excludes secrets.

---

# 37. Acceptance criteria tổng thể

## Navigation

- [ ] Mọi primary page truy cập trong tối đa 1 click từ sidebar.
- [ ] Active route rõ ràng.
- [ ] Critical status visible trên mọi page.

## Connection

- [ ] Connecting/connected/reconnecting/live-ended/error có UI riêng.
- [ ] Reconnect không xóa event đang xem.
- [ ] Disconnect mô tả rõ hậu quả.

## Events

- [ ] LIVE và MOCK phân biệt rõ.
- [ ] Event detail liên kết được action và voice.
- [ ] Burst event không làm browser lag đáng kể.
- [ ] Pause view không pause processing.

## Games

- [ ] Received và completed hiển thị riêng.
- [ ] Pairing code có countdown.
- [ ] Switch game hiển thị pending/in-flight.
- [ ] Active game disconnect tự cảnh báo/pause.

## Mappings

- [ ] Không cần gõ JSON để tạo rule cơ bản.
- [ ] Variable picker hoạt động.
- [ ] Rule conflict được giải thích.
- [ ] Dry-run là mặc định.
- [ ] Mapping mới mặc định disabled.

## Voice

- [ ] Queue status real-time.
- [ ] Provider error không khiến UI hiểu game action lỗi.
- [ ] Clear queue có confirmation.
- [ ] Interrupt policy có mô tả.
- [ ] Name normalization preview rõ.

## Simulator

- [ ] Event mock đi qua full pipeline.
- [ ] Scenario preset chạy được.
- [ ] Timeline hiển thị từng stage.
- [ ] Mock không thể bị nhầm với LIVE.

## Accessibility

- [ ] Keyboard navigation.
- [ ] Focus visible.
- [ ] Modal focus trap.
- [ ] Status không chỉ bằng màu.
- [ ] Reduced motion.

---

# 38. Open questions cho v0.2

Không chặn frontend v0.1:

1. Có cần command palette?
2. Có cần dark mode?
3. Có cần mobile remote control cho emergency controls?
4. Có cần overlay designer?
5. Có cần biểu đồ event/gift theo thời gian?
6. Có cần lưu workspace layout?
7. Có cần profile theo từng streamer/game?
8. Có cần localization Việt/Anh?
9. Có cần game thumbnail upload?
10. Có cần AI hỗ trợ tạo mapping/template?

---

# 39. Wireframe tổng hợp

## 39.1 Overview

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ CrowdCircuit   Ready ●   TikTok ●   Game ●   Voice ●   [Pause] [Mute] ⋯ │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Overview      │ Overview                            [Run Preflight Test]   │
│ Connection    │                                                            │
│ Events        │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐ │
│ Games         │ │ TikTok     │ │ Game       │ │ Events/min │ │ Voice     │ │
│ Mappings      │ │ Connected  │ │ Zombie     │ │ 128        │ │ 3 queued  │ │
│ Voice         │ └────────────┘ └────────────┘ └────────────┘ └───────────┘ │
│ Simulator     │                                                            │
│ Diagnostics   │ ┌────────────────────────────────┐ ┌─────────────────────┐ │
│               │ │ Recent Activity                │ │ Quick Controls      │ │
│ Settings      │ │ Gift · Rose ×5 → Zombie       │ │ Pause Actions       │ │
│               │ │ Comment · team đỏ → Join      │ │ Mute Voice          │ │
│               │ │ Follow → Welcome voice        │ │ Clear Queue         │ │
│               │ └────────────────────────────────┘ └─────────────────────┘ │
└───────────────┴────────────────────────────────────────────────────────────┘
```

## 39.2 Mapping Editor

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ ← Mappings   Rose spawns zombie                      [Save] [Enable]       │
├────────────────────────┬───────────────────────────┬───────────────────────┤
│ TRIGGER                │ ACTION                    │ TEST & PREVIEW        │
│ Event: Gift sent       │ Game: Zombie Survival    │ Test User             │
│                        │ Action: SPAWN_ZOMBIE      │ Rose ×5               │
│ Conditions             │                           │                       │
│ Gift ID = rose         │ amount                   │ MATCHED                │
│ Quantity >= 1          │ payload.quantity         │ SPAWN_ZOMBIE ×5       │
│                        │                           │                       │
│ + Add condition        │ ownerName                 │ 2 rules also match    │
│                        │ user.displayName          │ [View conflict]       │
│ ADVANCED               │                           │                       │
│ Cooldown 0             │ CONTROLS                  │ [Dry Run]             │
│ Max 120/min            │ TTL 10s                   │ [Send to Game]        │
└────────────────────────┴───────────────────────────┴───────────────────────┘
```

## 39.3 Voice

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Voice         [Control] [Templates] [Pronunciation]                       │
├─────────────────────────────────────┬──────────────────────────────────────┤
│ SETTINGS                            │ NOW PLAYING                          │
│ Enabled ●                           │ “Cảm ơn Minh...”                     │
│ Provider: Edge TTS                  │ ███████████░░ 72%                    │
│ Voice: Vietnamese Female           │                                      │
│ Tone: Gamer                         │ UP NEXT                              │
│ Interrupt: Never                    │ 1. Boss đã xuất hiện                 │
│ Volume: 90%                         │ 2. Chào mừng An                      │
│                                     │                                      │
│ [Test Voice]                        │ [Mute] [Clear Queue]                 │
└─────────────────────────────────────┴──────────────────────────────────────┘
```

---

# 40. Kết luận

CrowdCircuit Studio không nên trông như một trang admin CRUD thông thường. Nó là **bàn điều khiển một show tương tác thời gian thực**.

Thiết kế phải giữ cân bằng giữa:

- Đủ đơn giản để streamer vận hành khi đang LIVE.
- Đủ chi tiết để developer debug connector, mapping, action và TTS.
- Đủ an toàn để không tạo duplicate action, spam voice hoặc switch game thiếu kiểm soát.
- Đủ modular để thêm game và connector sau này.

Luồng UX cốt lõi cần được bảo vệ là:

```text
Connect
   → Verify
   → Configure
   → Simulate
   → Go Live
   → Monitor
   → Recover safely
```

Nếu frontend agent phải tự đoán về trạng thái, hậu quả của action hoặc flow chuyển game, spec chưa đủ tốt. Mục tiêu của tài liệu này là loại bỏ phần đoán đó trước khi code.
