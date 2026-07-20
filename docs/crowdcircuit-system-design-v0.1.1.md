# CrowdCircuit — System Design v0.1.1

**Trạng thái:** Implementation-ready draft v0.1.1  
**Ngày:** 20/07/2026  
**Mục tiêu tài liệu:** Làm cơ sở triển khai MVP và tạo contract thống nhất cho các coding agent.  
**Tên sản phẩm:** CrowdCircuit  
**Thương hiệu đầy đủ:** CrowdCircuit by MS24 Labs  
**Đơn vị phát triển:** MS24 Labs  
**Tagline:** *Turn live viewers into players.*

## Changelog v0.1.1

Phiên bản này giữ nguyên kiến trúc nền của v0.1 và làm rõ các runtime semantics có thể gây implementation không tương thích:

- Định nghĩa vòng đời local session token, client role và pairing flow.
- Tách ACK nhận action (`received`) khỏi kết quả xử lý (`completed`/`failed`).
- Định nghĩa `matchMode`, tie-breaker và exclusive group cho Mapping Engine.
- Thêm gift streak inactivity timeout, max lifetime và disconnect flush.
- Chuyển dedup sang chiến lược riêng theo từng event type.
- Thêm active-game transition và xử lý action in-flight.
- Thêm global action budget cho toàn game.
- Thêm graceful shutdown, startup reconciliation và crash recovery.
- Chốt CORS/origin policy, metrics JSON endpoint và voice interrupt mode.
- Chốt tên sản phẩm `CrowdCircuit`, thương hiệu `CrowdCircuit by MS24 Labs` và tagline `Turn live viewers into players.`

---

## 0.1 Quy ước thương hiệu và định danh kỹ thuật

- **Tên sản phẩm hiển thị:** CrowdCircuit
- **Tên thương hiệu đầy đủ:** CrowdCircuit by MS24 Labs
- **Tên repository:** `crowdcircuit`
- **Tên SDK client:** `CrowdCircuitClient`
- **Package scope đề xuất:** `@crowdcircuit/*`
- **Tên kỹ thuật của các contract** như `LiveEventEnvelope`, `GameActionEnvelope` và `VoiceIntent` được giữ nguyên để phản ánh đúng chức năng, không gắn cứng với thương hiệu.

Trong giao diện người dùng, tài liệu và thông tin phát hành, ưu tiên dùng `CrowdCircuit`. Cụm `by MS24 Labs` xuất hiện tại splash screen, About, footer và metadata phát hành; không cần lặp lại trong tên từng module nội bộ.

---

## 1. Tóm tắt điều hành

CrowdCircuit là một nền tảng chạy local trên máy streamer, có nhiệm vụ:

1. Kết nối tới một phiên TikTok LIVE.
2. Nhận các sự kiện như gift, comment, follow, share, like và viewer join.
3. Chuẩn hóa dữ liệu từ TikTok thành một event contract ổn định.
4. Chuyển event thành action của game thông qua Mapping Engine.
5. Phát action tới game qua WebSocket.
6. Tạo lời cảm ơn hoặc lời bình luận bằng Voice Reaction Engine.
7. Sinh giọng nói TTS và phát âm thanh lên livestream.
8. Cung cấp dashboard để kết nối LIVE, xem event, cấu hình mapping, chỉnh voice và giả lập event.

MVP được thiết kế theo hướng **local-first, single-stream, single-active-game và modular monolith**. TikTok connector, TTS provider và game đều được đặt sau các interface có thể thay thế.

---

## 2. Bối cảnh và vấn đề

Các game TikTok LIVE tương tác thường cần liên kết hành động của người xem với gameplay:

- Người xem tặng Rose → sinh zombie.
- Người xem tặng gift lớn → gọi boss.
- Comment `đỏ` hoặc `xanh` → chọn đội.
- Follow → tạo nhân vật mang tên người xem.
- Đạt mốc like → kích hoạt sự kiện toàn bản đồ.
- Tặng gift → hệ thống đọc tên và cảm ơn bằng giọng nói.

Nếu từng game tự kết nối TikTok, tự xử lý gift và tự sinh TTS thì hệ thống sẽ:

- Lặp code.
- Khó thay connector khi TikTok thay đổi.
- Khó kiểm thử nếu không mở LIVE thật.
- Khó thêm game mới.
- Khó quản lý spam, gift combo và hàng đợi âm thanh.
- Khó đổi nhà cung cấp TTS.

CrowdCircuit giải quyết vấn đề bằng cách tạo một lớp trung gian dùng chung giữa TikTok LIVE và các game.

---

## 3. Căn cứ kỹ thuật và ràng buộc nền tảng

Tại thời điểm viết tài liệu:

- Luồng TikTok LIVE gift/comment không được coi là một webhook công khai ổn định trong thiết kế này.
- Connector mã nguồn mở phổ biến kết nối vào dịch vụ Webcast nội bộ và cần được coi là một adapter có nguy cơ thay đổi.
- TikFinity cung cấp WebSocket local nhưng yêu cầu ứng dụng desktop của TikFinity chạy trên cùng máy.
- Connector mã nguồn mở có điều khoản license cần được rà soát trước khi phân phối thương mại.
- Vì vậy, toàn bộ phần phụ thuộc TikTok phải nằm sau `LiveConnector` interface.

### Chiến lược connector

| Môi trường | Connector ưu tiên | Lý do |
|---|---|---|
| Phát triển MVP | `tiktok-live-connector` | Nhanh, TypeScript/Node.js, nhận được nhiều loại event |
| Phương án dự phòng local | TikFinity WebSocket | Giảm lượng code tự bắt event |
| Sản phẩm thương mại | Managed LIVE API hoặc đối tác được phê duyệt | Giảm rủi ro connector bị gãy và rủi ro vận hành |

---

## 4. Phạm vi phiên bản v0.1

### 4.1 Goals

MVP phải:

- Kết nối được tới một TikTok LIVE bằng username.
- Hiển thị trạng thái kết nối.
- Nhận và log được các event quan trọng.
- Chuẩn hóa event theo schema nội bộ.
- Cho phép giả lập event mà không cần LIVE thật.
- Chuyển event thành game action bằng rule cấu hình.
- Phát action tới một game đang hoạt động.
- Đọc tên người dùng và lời cảm ơn bằng TTS.
- Có hàng đợi giọng nói, ưu tiên và cooldown.
- Có dashboard local để điều khiển.
- Lưu cấu hình bằng SQLite.
- Có cơ chế reconnect và xử lý event trùng.
- Cho phép thêm game mới mà không sửa TikTok connector.

### 4.2 Non-goals

v0.1 chưa xử lý:

- Nhiều streamer đồng thời.
- Nhiều room LIVE đồng thời.
- Cloud hosting.
- Đồng bộ cấu hình giữa nhiều máy.
- Marketplace plugin.
- Thanh toán hoặc subscription.
- Quản lý nhiều tài khoản người dùng.
- AI tự viết câu thoại theo ngữ cảnh.
- Hỗ trợ Twitch hoặc YouTube LIVE.
- Lưu toàn bộ lịch sử lâu dài để phân tích kinh doanh.
- Điều khiển gameplay qua video/audio recognition.
- Bảo đảm exactly-once tuyệt đối.

---

## 5. Assumptions

- Hệ thống chạy trên Windows 10/11.
- Streamer sử dụng OBS hoặc TikTok LIVE Studio.
- Backend và dashboard chạy trên cùng máy.
- Chỉ một profile game được active tại một thời điểm.
- Một game có thể có nhiều browser source nhưng dùng chung `gameInstanceId`.
- Game đầu tiên là game web 2D, ưu tiên Phaser.
- Backend sử dụng Node.js và TypeScript.
- Dashboard sử dụng React.
- SQLite đủ cho MVP.
- Không yêu cầu đăng nhập trong bản local.
- API chỉ bind vào `127.0.0.1` theo mặc định.
- Voice output được phát qua một trang browser source riêng để OBS/TikTok LIVE Studio capture âm thanh.

---

## 6. Personas và use cases

### 6.1 Streamer

Streamer muốn:

- Nhập username TikTok và kết nối.
- Xem event đang chạy.
- Chọn game.
- Chọn gift nào kích hoạt hành động nào.
- Bật/tắt đọc tên.
- Chọn giọng đọc.
- Chỉnh văn mẫu.
- Test gift mà không cần donate thật.
- Tạm dừng game interaction khi cần.
- Xóa hàng đợi giọng nói khi bị spam.

### 6.2 Game developer

Game developer muốn:

- Kết nối vào gateway bằng SDK.
- Khai báo danh sách action game hỗ trợ.
- Nhận action với payload có schema rõ ràng.
- ACK action đã xử lý.
- Dùng mock event để test.
- Không cần biết TikTok trả raw data như thế nào.

### 6.3 Viewer

Viewer có thể:

- Comment để chọn đội hoặc gửi lệnh.
- Gift để tạo hiệu ứng.
- Nghe hệ thống đọc tên và cảm ơn.
- Thấy tên/avatar của mình xuất hiện trong game.
- Tương tác liên tục mà không làm hệ thống đọc chồng âm thanh.

---

## 7. Yêu cầu chức năng

### FR-01 — Kết nối TikTok LIVE

- Nhập `uniqueId` của streamer.
- Connect, disconnect và reconnect.
- Hiển thị room ID nếu có.
- Hiển thị trạng thái:
  - `DISCONNECTED`
  - `CONNECTING`
  - `CONNECTED`
  - `RECONNECTING`
  - `LIVE_ENDED`
  - `ERROR`

### FR-02 — Nhận event

Các event ưu tiên:

- `live.connected`
- `live.disconnected`
- `live.ended`
- `viewer.joined`
- `chat.comment`
- `social.follow`
- `social.share`
- `engagement.like`
- `gift.sent`
- `subscription.created`, nếu connector cung cấp

### FR-03 — Chuẩn hóa event

- Mọi adapter phải output cùng một `LiveEventEnvelope`.
- Dữ liệu raw chỉ được giữ trong debug log tùy chọn.
- Connector-specific field không được rò rỉ vào game SDK.

### FR-04 — Deduplication và event aggregation

- Mỗi event có `eventId`.
- Ưu tiên connector event ID hoặc sequence ID khi chúng ổn định.
- Chiến lược fallback fingerprint phải được định nghĩa riêng theo từng event type.
- Comment không được dedup theo timestamp làm tròn theo giây.
- Gift combo phải tránh xử lý nhiều lần cùng một streak.
- Like phải được aggregate, không dedup và phát từng like riêng lẻ.
- Lưu recent dedup keys trong TTL cache có giới hạn kích thước.

### FR-05 — Mapping Engine

Mapping profile phải định nghĩa `matchMode` để xác định một event có thể kích hoạt một hay nhiều rule. Việc sắp xếp rule phải deterministic ngay cả khi cùng priority.

Cho phép rule theo:

- Event type.
- Gift ID hoặc gift name.
- Số lượng.
- Giá trị diamond nếu có.
- Nội dung comment.
- Regex comment.
- Mốc like.
- User role hoặc badge nếu có.
- Cooldown.
- Xác suất kích hoạt.
- Giới hạn action mỗi khoảng thời gian.

### FR-06 — Game Action Gateway

- Phát action qua WebSocket.
- Action có `actionId`.
- Game gửi receipt ACK `received` ngay khi action được nhận và chấp nhận vào hàng đợi local.
- Game gửi result `completed` hoặc `failed` sau khi gameplay xử lý xong.
- Retry chỉ dựa trên việc thiếu receipt ACK, không dựa trên thời gian hoàn tất animation/gameplay.
- SDK chống xử lý trùng action bằng `actionId`.
- Game có thể gửi trạng thái và progress về dashboard.

### FR-07 — Voice Reaction Engine

- Đọc nickname hoặc tên đã chuẩn hóa.
- Hỗ trợ interrupt policy: `never_interrupt`, `interrupt_lower_priority`, `interrupt_any`.
- Chọn template ngẫu nhiên.
- Có nhiều tone.
- Gom gift trong một cửa sổ thời gian.
- Có priority queue.
- Có cooldown theo user và event type.
- Có từ điển phát âm.
- Có fallback nếu tên không phù hợp.
- Không cho comment người xem chèn trực tiếp SSML hoặc code.
- Có thể dùng voice cho thông báo gameplay.

### FR-08 — TTS

- Interface hỗ trợ nhiều provider.
- Sinh audio file hoặc audio URL.
- Cache các câu phổ biến.
- Retry một lần khi lỗi.
- Hủy job nếu quá hạn.
- Có browser source phát audio tuần tự.
- Dashboard có nút test giọng.

### FR-09 — Dashboard

Dashboard cùng origin được bootstrap admin session tự động; game và voice-output dùng pairing flow để nhận role token.

Dashboard gồm:

1. Connection.
2. Live event monitor.
3. Active game.
4. Event mappings.
5. Voice settings.
6. Templates.
7. Pronunciation dictionary.
8. Test event generator.
9. Logs và diagnostics.
10. Emergency controls.

### FR-10 — Mock Event System

Cho phép tạo:

- Gift.
- Comment.
- Follow.
- Like milestone.
- Join.
- Share.
- Game event.
- TTS-only event.

Mock event phải đi qua gần như toàn bộ pipeline thật, chỉ khác `source = "mock"`.

### FR-11 — Config persistence

- Lưu config vào SQLite.
- Export/import profile JSON.
- Có schema version.
- Có migration.

### FR-12 — Emergency controls

- Pause toàn bộ mappings.
- Mute voice.
- Clear voice queue.
- Disconnect TikTok.
- Disable một rule.
- Stop active game actions.

---

## 8. Yêu cầu phi chức năng

### 8.1 Hiệu năng

- P95 từ lúc nhận event đến lúc phát game action: dưới 250 ms trong local network.
- Dashboard update event: dưới 500 ms.
- Chịu burst tối thiểu 100 normalized events/giây.
- Like events phải được aggregate.
- TTS không nằm trên critical path của game action.

### 8.2 Độ tin cậy

- Tự reconnect với exponential backoff và jitter.
- Không crash toàn hệ thống khi một module lỗi.
- TTS lỗi không làm game action lỗi.
- Game disconnect không làm connector disconnect.
- Config được ghi transactionally.

### 8.3 Khả năng mở rộng

- Thay connector mà không sửa mapping/game.
- Thay TTS provider mà không sửa voice rules.
- Thêm game qua manifest và SDK.
- Event schema có version.

### 8.4 Bảo mật

- Bind local-only mặc định.
- Mỗi server runtime sinh một secret ngẫu nhiên mới; không hard-code token trong source hoặc manifest.
- Client được cấp role token giới hạn quyền: `admin`, `game`, `voice-output`.
- Pairing code là one-time, hết hạn nhanh và chỉ đổi được trên localhost.
- WebSocket client phải xác thực role token và khai báo đúng client role.
- Validate toàn bộ payload.
- Escape text trước khi render.
- Không thực thi command shell từ event.
- Không đọc comment tùy ý bằng TTS mặc định.
- Không lưu TikTok password.
- Không log token/cookie nếu về sau thêm authenticated connector.

### 8.5 Observability

- Structured JSON logs.
- Correlation ID xuyên suốt event → action → voice job.
- MVP export metrics dưới dạng JSON tại `GET /api/v1/diagnostics/metrics`; chưa yêu cầu Prometheus.
- Metrics:
  - Events received.
  - Events dropped.
  - Duplicate events.
  - Mapping matches.
  - Action ACK latency.
  - TTS queue length.
  - TTS failures.
  - Reconnect count.

---

## 9. Kiến trúc tổng thể

```text
┌──────────────────────┐
│     TikTok LIVE      │
└──────────┬───────────┘
           │ raw events
           ▼
┌──────────────────────┐
│ LiveConnector Adapter│
│ - TikTokConnector    │
│ - TikFinityAdapter   │
│ - MockConnector      │
└──────────┬───────────┘
           │ connector events
           ▼
┌──────────────────────┐
│ Event Normalizer     │
│ Validation + Version │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ Deduper / Aggregator │
│ Gift combo / Likes   │
└──────────┬───────────┘
           ▼
┌───────────────────────────────────────────────┐
│                Internal Event Bus             │
└──────────┬────────────────┬───────────────────┘
           │                │
           ▼                ▼
┌──────────────────┐  ┌────────────────────────┐
│ Mapping Engine   │  │ Voice Reaction Engine  │
└─────────┬────────┘  └────────────┬───────────┘
          │ game actions            │ voice intents
          ▼                         ▼
┌──────────────────┐  ┌────────────────────────┐
│ Action Gateway   │  │ TTS Provider + Queue   │
│ WebSocket        │  └────────────┬───────────┘
└─────────┬────────┘               │ audio jobs
          │                         ▼
          ▼              ┌────────────────────────┐
┌──────────────────┐     │ Voice Output Browser   │
│ Game / Game SDK  │     │ Source                 │
└──────────────────┘     └────────────────────────┘

           ┌──────────────────────────────┐
           │ Dashboard + REST Admin API   │
           │ Config / Logs / Test Events  │
           └──────────────────────────────┘
```

---

## 10. Quyết định kiến trúc

### ADR-001 — Modular monolith

**Quyết định:** Backend v0.1 là một process Node.js có module rõ ràng.

**Lý do:**

- Chạy local.
- Dễ debug.
- Không cần message broker ngoài.
- Độ trễ thấp.
- Ít cấu hình.
- Có thể tách service sau khi có nhu cầu thực.

### ADR-002 — In-process event bus

Dùng event bus nội bộ có typed event, ví dụ EventEmitter wrapper.

Không dùng Kafka, RabbitMQ hoặc Redis trong v0.1.

### ADR-003 — WebSocket cho game integration

Game action cần độ trễ thấp, hai chiều và ACK. WebSocket phù hợp hơn polling hoặc webhook local.

### ADR-004 — Versioned event contract

Mọi event và action có `specVersion`. Breaking change phải tăng major version.

### ADR-005 — Local-first

Toàn bộ hệ thống có thể chạy offline ngoại trừ TikTok connector và TTS provider yêu cầu mạng.

### ADR-006 — Browser game first

v0.1 ưu tiên game web/Phaser. Unity, Godot và Unreal sẽ dùng chung protocol ở giai đoạn sau.

### ADR-007 — Game là authority của gameplay

Gateway chỉ gửi action. Trạng thái gameplay chính nằm trong game. Gateway không cố mô phỏng toàn bộ state của game.

### ADR-008 — Ephemeral local credentials

Mỗi lần server khởi động tạo một runtime secret mới. Token client là credential ngắn hạn theo role và không được lưu vĩnh viễn trong game manifest, source code hoặc SQLite. Dashboard production chạy same-origin; game và voice-output nhận token qua pairing flow.

---

## 11. Thiết kế component

## 11.1 LiveConnector

```ts
interface LiveConnector {
  readonly id: string;
  connect(config: ConnectorConfig): Promise<ConnectionInfo>;
  disconnect(): Promise<void>;
  getStatus(): ConnectorStatus;
  onEvent(handler: (event: ConnectorEvent) => void): Unsubscribe;
  onStatus(handler: (status: ConnectorStatus) => void): Unsubscribe;
}
```

Implementations:

- `TikTokLiveConnectorAdapter`
- `TikFinityConnectorAdapter`
- `MockConnector`

Trách nhiệm:

- Kết nối nguồn event.
- Reconnect.
- Chuyển raw callback thành connector event tối thiểu.
- Không chứa game logic.
- Không chứa TTS logic.
- Không tự ghi trực tiếp vào SQLite ngoài connection diagnostics.

### Connection state machine

```text
DISCONNECTED
    │ connect()
    ▼
CONNECTING ───── error ─────► ERROR
    │ success                  │ retry
    ▼                          ▼
CONNECTED ── lost ───────► RECONNECTING
    │ live ended               │ success
    ▼                          └────► CONNECTED
LIVE_ENDED
```

### Reconnect policy

- Lần 1: 1 giây.
- Lần 2: 2 giây.
- Lần 3: 5 giây.
- Sau đó: 10, 20, tối đa 30 giây.
- Jitter ±20%.
- Reset counter sau 60 giây kết nối ổn định.
- Không reconnect khi streamer chủ động disconnect.

---

## 11.2 Event Normalizer

Nhiệm vụ:

- Map event từ connector về schema nội bộ.
- Chuẩn hóa timestamp.
- Chuẩn hóa user.
- Chuẩn hóa gift.
- Validate bằng runtime schema.
- Gắn correlation metadata.
- Loại bỏ field không cần thiết.

Không nên sử dụng raw connector object bên ngoài module này.

---

## 11.3 Deduper và Aggregator

### Nguyên tắc chung

Dedup không dùng một fingerprint chung cho mọi event. Module phải chọn strategy dựa trên `eventType` để tránh false positive và false negative.

Thứ tự ưu tiên:

1. Connector event ID đáng tin cậy.
2. Connector sequence ID hoặc message ID.
3. Event-specific fingerprint trong một cửa sổ thời gian ngắn.
4. Nếu không có đủ dữ liệu để dedup an toàn, chấp nhận event và dựa vào downstream rate limit thay vì drop nhầm.

Cache dùng LRU có TTL, tối đa 50.000 keys. TTL mặc định có thể khác nhau theo strategy.

### Dedup strategy theo event type

#### Gift

Key ưu tiên:

```text
roomId + userId + giftId + streakId + repeatCount + sequenceId
```

Nếu thiếu `streakId`/`sequenceId`, fallback có thể dùng connector timestamp millisecond và trạng thái streak. Gift dedup TTL mặc định: 5 phút.

#### Comment

Ưu tiên `connectorEventId` hoặc `sequenceId`.

Fallback key:

```text
roomId + userId + normalizedText + occurredAtEpochMs
```

Cửa sổ fallback dedup chỉ 100–300 ms. Không làm tròn timestamp theo giây. Hai comment giống nhau được gửi cách nhau ngoài cửa sổ phải được coi là hai event hợp lệ.

Không thêm random nonce vào dedup key vì điều đó làm mất khả năng phát hiện bản sao của cùng một event.

#### Follow, share, join

Ưu tiên event ID. Nếu thiếu, dùng key theo user + event type + cửa sổ thời gian phù hợp. `viewer.joined` có thể được sampling hoặc drop trước khi vào event log ở phòng đông.

#### Like

Không dedup từng like. Connector adapter quy đổi thành `like.delta`; Aggregator cộng dồn và emit:

- `like.delta` tối đa một lần mỗi giây; hoặc
- `like.milestone` khi vượt các mốc đã cấu hình.

### Gift streak state machine

Gift streakable được quản lý theo key:

```text
roomId + userId + giftId + streakId
```

Trạng thái:

```text
OPEN → UPDATED → FINALIZED
              ↘ ABORTED
```

Các nguyên nhân finalize:

- `connector_end`: nhận event END thật.
- `inactivity_timeout`: không có update mới trong `streakTimeoutMs`.
- `max_lifetime`: streak tồn tại quá `maxStreakLifetimeMs`.
- `disconnect_flush`: connector mất kết nối.
- `shutdown_flush`: ứng dụng graceful shutdown.

Mặc định:

```json
{
  "streakTimeoutMs": 3000,
  "maxStreakLifetimeMs": 30000,
  "disconnectPolicy": "finalize_incomplete"
}
```

Quy tắc:

- Mỗi update reset inactivity timer.
- `FINALIZED` chỉ được emit một lần.
- Finalized event có `endReason` và `isIncomplete`.
- Voice chỉ tạo lời cảm ơn sau finalize.
- Mapping realtime có thể opt-in nhận `start`/`update`; mặc định game chỉ nhận normalized final gift.
- Khi disconnect, streak mở được finalize với `isIncomplete = true`; không treo trong RAM và không replay sau reconnect.

### Like aggregation

Không tạo action trên từng like.

Ví dụ:

- Tích lũy tổng like.
- Khi vượt mốc 1.000, 2.000, 5.000 thì emit milestone.
- Hoặc emit `like.delta` mỗi 1 giây.

---

## 11.4 Internal Event Bus

Typed channels:

- `live.event.normalized`
- `live.event.dropped`
- `game.action.created`
- `game.action.received`
- `game.action.completed`
- `game.action.failed`
- `voice.intent.created`
- `voice.job.created`
- `voice.job.ready`
- `voice.playback.started`
- `voice.playback.finished`
- `system.status.changed`

Mỗi handler phải:

- Có timeout.
- Được bọc lỗi.
- Không được làm block connector loop.
- Có metric riêng.

---

## 11.5 Mapping Engine

### Mapping profile execution policy

Mỗi game profile định nghĩa:

```json
{
  "matchMode": "all",
  "globalActionBudget": {
    "maxPerSecond": 30,
    "burst": 50,
    "overflowPolicy": "drop_low_priority"
  }
}
```

`matchMode`:

- `all`: mọi rule match đều có thể fire.
- `first`: chỉ rule đứng đầu sau khi sắp xếp deterministic được fire.
- `exclusive_group`: nhiều rule có thể fire, nhưng mỗi `exclusiveGroup` chỉ chọn một rule thắng.

Rule structure:

```json
{
  "id": "map_rose_spawn_zombie",
  "name": "Rose spawns zombie",
  "enabled": true,
  "priority": 100,
  "exclusiveGroup": "spawn.primary",
  "eventType": "gift.sent",
  "conditions": [
    {
      "field": "payload.gift.id",
      "operator": "eq",
      "value": "rose"
    }
  ],
  "transform": {
    "actionType": "SPAWN_ZOMBIE",
    "parameters": {
      "amount": "{{payload.quantity}}",
      "ownerName": "{{user.displayName}}",
      "avatarUrl": "{{user.avatarUrl}}"
    }
  },
  "controls": {
    "cooldownMs": 0,
    "maxActionsPerMinute": 120,
    "aggregationWindowMs": 0,
    "actionPriority": 60
  },
  "createdAt": "2026-07-20T03:00:00.000Z"
}
```

### Operators v0.1.1

- `eq`
- `neq`
- `gt`
- `gte`
- `lt`
- `lte`
- `contains`
- `startsWith`
- `regex`
- `in`

### Specificity score

Specificity dùng để tie-break giữa các rule cùng priority. Gợi ý điểm:

- Exact gift ID / exact command: +100.
- Exact scalar equality: +50.
- Numeric range: +30.
- Prefix/contains: +20.
- Regex: +10.
- Không condition: +0.

### Deterministic ordering

Rule được sắp theo:

```text
priority DESC
specificity DESC
createdAt ASC
ruleId ASC
```

Không phụ thuộc thứ tự trả về của SQLite hoặc thứ tự object trong JSON.

### Rule evaluation

1. Lọc theo `eventType` và trạng thái `enabled`.
2. Tính specificity.
3. Sắp theo deterministic ordering.
4. Kiểm tra conditions.
5. Kiểm tra per-user, per-rule và per-game budgets.
6. Áp dụng `matchMode` và `exclusiveGroup`.
7. Build action.
8. Validate action theo game manifest.
9. Emit action.
10. Ghi action log cùng rule ordering metadata.

### Rate limit ba tầng

1. Per-user: chống một viewer flood action.
2. Per-rule: `maxActionsPerMinute` và cooldown.
3. Per-game global budget: bảo vệ game khi nhiều rule cùng hợp lệ.

Overflow policies:

- `drop_low_priority` — mặc định.
- `queue_with_ttl` — chỉ dùng cho action có thể chậm.
- `reject_newest`.

Không queue vô hạn action gameplay.

### Comment command

Ví dụ:

```json
{
  "eventType": "chat.comment",
  "conditions": [
    {
      "field": "payload.textNormalized",
      "operator": "eq",
      "value": "team đỏ"
    }
  ],
  "transform": {
    "actionType": "JOIN_TEAM",
    "parameters": {
      "team": "red",
      "viewerId": "{{user.id}}",
      "viewerName": "{{user.displayName}}"
    }
  }
}
```

---

## 11.6 Local Session Token và Client Pairing

### Mục tiêu

Credential local giúp ngăn một trang hoặc process khác trên máy tự ý điều khiển admin API, inject game action hoặc phát audio. Cơ chế này không thay thế sandbox hệ điều hành và không được quảng bá như bảo mật cloud-grade.

### Runtime secret lifecycle

1. Server khởi động.
2. Sinh `runtimeSecret` bằng CSPRNG, tối thiểu 32 bytes.
3. Secret chỉ giữ trong memory và không ghi SQLite/log.
4. Server restart tạo secret mới, làm mọi token cũ mất hiệu lực.
5. Graceful shutdown xóa reference trong memory.

### Client roles

| Role | Quyền chính |
|---|---|
| `admin` | Quản lý connector, mappings, voice, games, simulator và diagnostics |
| `game` | Register game instance, nhận action, ACK/result, report state |
| `voice-output` | Nhận audio job, báo playback started/finished/error |

Token không được dùng chéo role.

### Dashboard bootstrap

Production dashboard được serve cùng origin với backend.

- Lần tải đầu, server đặt một `HttpOnly`, `SameSite=Strict` admin session cookie.
- Cookie chỉ được cấp cho request từ loopback interface và origin được whitelist.
- CSRF-sensitive write dùng CSRF token hoặc kiểm tra same-origin nghiêm ngặt.
- Dev mode whitelist rõ các Vite origins; không dùng wildcard CORS.

### Pairing flow cho game và voice-output

1. Admin dashboard yêu cầu tạo pairing code cho role cụ thể.
2. Server tạo code một lần, entropy đủ cao, TTL mặc định 60 giây.
3. Game/voice-output gửi code tới `POST /api/v1/auth/pair` từ loopback.
4. Server đổi code thành opaque role token.
5. Pairing code bị revoke ngay sau lần dùng đầu tiên.
6. Token chỉ sống trong runtime hiện tại; mặc định TTL 12 giờ nhưng không vượt quá lifetime của server process.
7. Client giữ token trong memory hoặc session storage; không commit vào source, manifest hoặc localStorage dài hạn.

Pair request:

```json
{
  "pairingCode": "LPG-7W4K-92PQ",
  "clientRole": "game",
  "clientId": "zombie-survival:instance-uuid"
}
```

Pair response:

```json
{
  "accessToken": "opaque-runtime-token",
  "role": "game",
  "expiresAt": "2026-07-20T15:00:00.000Z"
}
```

### Token validation và rotation

- Token là opaque HMAC-signed token hoặc random token lưu trong in-memory session registry.
- MVP ưu tiên opaque random token + in-memory registry để revoke dễ dàng.
- Token được kiểm tra ở HTTP và WebSocket handshake.
- Admin có thể revoke từng client hoặc revoke toàn bộ non-admin token.
- Không tự rotate giữa phiên nếu client đang hoạt động; client re-pair khi token hết hạn hoặc server restart.
- Logs chỉ ghi token fingerprint 8 ký tự, không ghi raw token.

### WebSocket authentication

Client gửi token trong handshake auth field, không truyền qua query string để giảm rò rỉ vào logs:

```ts
io("ws://127.0.0.1:3100/game", {
  auth: { token: runtimeToken }
});
```

Server xác minh role trước khi cho join namespace.

---

## 11.7 Game Registry và Game Manifest

Mỗi game có manifest:

```json
{
  "id": "zombie-survival",
  "name": "Zombie Survival",
  "version": "0.1.0",
  "sdkVersion": "0.1",
  "entryUrl": "http://127.0.0.1:5174",
  "actions": {
    "SPAWN_ZOMBIE": {
      "description": "Spawn zombies owned by a viewer",
      "schema": {
        "type": "object",
        "required": ["amount", "ownerName"],
        "properties": {
          "amount": {
            "type": "integer",
            "minimum": 1,
            "maximum": 100
          },
          "ownerName": {
            "type": "string",
            "maxLength": 50
          },
          "avatarUrl": {
            "type": ["string", "null"]
          }
        }
      }
    },
    "SPAWN_BOSS": {
      "description": "Spawn one boss",
      "schema": {
        "type": "object",
        "required": ["ownerName"]
      }
    }
  }
}
```

Dashboard đọc manifest để hiển thị danh sách action hợp lệ khi tạo mapping.

### Game lifecycle

- `REGISTERED`
- `STARTING`
- `CONNECTED`
- `ACTIVE`
- `DRAINING`
- `PAUSED`
- `DISCONNECTED`
- `ERROR`

### Active-game transition

Chỉ một game profile được `ACTIVE`. Việc đổi game là một transaction logic:

```text
ACTIVE_OLD
   ↓ switch requested
DRAINING_OLD
   ↓ stop creating new actions for old profile
   ↓ wait receipt ACK for already-sent actions, tối đa 2 giây
PAUSED_OLD
   ↓ atomically activate profile + mappings mới
ACTIVE_NEW
```

Quy tắc:

- Action chưa gửi của game cũ bị cancel với reason `game_switched`.
- Action đã gửi nhưng chưa có receipt ACK được chờ trong drain window; sau timeout đánh dấu `delivery_unknown`, không gửi sang game mới.
- Action đã `received` được game cũ tự hoàn tất; result đến sau switch vẫn được ghi log.
- Không replay action của game cũ cho game mới.
- Mapping profile và active game ID được đổi atomically trong một SQLite transaction.
- Game cũ nhận `game.lifecycle.pause`; game mới phải register/ready trước khi activate nếu `strictSwitch = true`.
- Voice intent độc lập với gameplay được giữ; voice intent gắn `gameId` cũ và chưa phát được drop mặc định với reason `game_switched`.

---

## 11.8 Game SDK

API TypeScript đề xuất:

```ts
const client = new CrowdCircuitClient({
  gatewayUrl: "ws://127.0.0.1:3100/game",
  gameId: "zombie-survival",
  instanceId: crypto.randomUUID(),
  token: runtimeRoleToken
});

await client.connect();

client.onAction("SPAWN_ZOMBIE", async (action) => {
  // SDK gửi receipt ACK ngay sau khi action được validate và enqueue local.
  action.received();

  try {
    await game.spawnZombie(action.params);
    action.completed({ durationMs: action.elapsedMs() });
  } catch (error) {
    action.failed({ code: "SPAWN_FAILED", retryable: false });
  }
});

client.reportState({
  status: "RUNNING",
  score: 1250,
  players: 42
});
```

SDK phải:

- Tự reconnect và re-pair khi server restart/token hết hạn.
- Gửi `received` ngay sau validate + enqueue; gửi `completed`/`failed` riêng.
- Giữ LRU action IDs để tránh xử lý trùng; duplicate action vẫn gửi lại receipt ACK.
- Validate payload.
- Gửi heartbeat.
- Có event debug.
- Hỗ trợ test mode.

---

## 11.9 Action Gateway

### Delivery semantics

Hệ thống cung cấp **at-least-once delivery tới client với idempotency**, không tuyên bố exactly-once gameplay execution.

Tách hai tín hiệu:

1. `received`: game đã nhận, validate và đưa action vào hàng đợi local.
2. `completed` hoặc `failed`: gameplay đã xử lý xong.

Retry delivery chỉ dựa trên `received`.

### Delivery flow

```text
Server creates action
        ↓
Send game.action
        ↓
Game validates + enqueues
        ↓ ≤ 500 ms target
Send game.action.received
        ↓
Game performs animation/gameplay
        ↓
Send game.action.result(completed|failed)
```

Quy trình:

1. Server tạo `actionId` và persist action log trước khi send.
2. Server gửi action.
3. Game gửi `received` càng sớm càng tốt sau validate + enqueue.
4. Không nhận `received` trong `receiptTimeoutMs = 1000` → retry delivery.
5. Tối đa 2 retry, dùng cùng `actionId`.
6. SDK thấy `actionId` đã enqueue/xử lý thì không chạy lại nhưng vẫn gửi `received`.
7. Action hết TTL trước khi có receipt thì mark `expired` và không gửi tiếp.
8. Sau receipt, server không retry dù completion lâu hơn 1 giây.
9. Game gửi result `completed` hoặc `failed` khi xong; completion timeout chỉ dùng diagnostics, không tự replay.

### Action state machine

```text
CREATED → SENT → RECEIVED → COMPLETED
              ↘ EXPIRED       ↘ FAILED
              ↘ DELIVERY_FAILED
```

`delivery_unknown` dùng khi game switch/shutdown xảy ra sau send nhưng trước receipt.

### Result payload

```json
{
  "type": "game.action.result",
  "actionId": "act_123",
  "status": "completed",
  "durationMs": 2840,
  "details": {}
}
```

Failed result:

```json
{
  "type": "game.action.result",
  "actionId": "act_123",
  "status": "failed",
  "error": {
    "code": "SPAWN_FAILED",
    "message": "Entity cap reached",
    "retryable": false
  }
}
```

Gateway không tự retry gameplay action khi result là `failed` trừ khi mapping/action type có policy explicit và idempotent.

### TTL mặc định

- Action gameplay thường: 10 giây để được nhận.
- Action boss/gift lớn: 30 giây để được nhận.
- Comment command: 5 giây để được nhận.
- Completion có thể dài hơn TTL delivery; game manifest có thể khai báo `expectedCompletionMs` chỉ phục vụ UI/diagnostics.

### Global action budget

Action Gateway áp dụng token bucket cho active game profile sau khi rule-level limits đã chạy.

Mặc định:

```json
{
  "maxPerSecond": 30,
  "burst": 50,
  "overflowPolicy": "drop_low_priority"
}
```

Khi overflow:

- Drop action priority thấp trước.
- Không drop action đã có receipt.
- Ghi metric và action log reason.
- Có thể coalesce action cùng type nếu manifest khai báo `coalescible = true`.

---

## 11.10 Voice Reaction Engine

Voice engine nhận normalized event hoặc game event và tạo `VoiceIntent`.

### Pipeline

```text
Event
  ↓
Voice Rule Matching
  ↓
Aggregation / Cooldown
  ↓
Name Normalization
  ↓
Template Selection
  ↓
Content Moderation
  ↓
VoiceIntent
  ↓
Priority Queue
  ↓
TTS Generation
  ↓
Audio Playback
```

### Voice rule example

```json
{
  "id": "voice_thank_gift",
  "enabled": true,
  "eventType": "gift.sent",
  "conditions": [],
  "priority": 80,
  "templateGroup": "gift.default",
  "aggregation": {
    "key": "{{user.id}}:{{payload.gift.id}}",
    "windowMs": 3000
  },
  "cooldown": {
    "scope": "user",
    "durationMs": 5000
  }
}
```

### Template groups

```json
{
  "gift.default": [
    "Cảm ơn {name} đã tặng {count} {giftName} nhé!",
    "{name} vừa tiếp tế {count} {giftName} cho trận đấu!",
    "Úi, cảm ơn {name}! Có thêm {count} {giftName} rồi!"
  ],
  "gift.spawn_enemy": [
    "{name} vừa gọi thêm {count} quái vật vào bản đồ!",
    "Cảm ơn {name}. Team mình chuẩn bị ăn hành tiếp nhé!"
  ],
  "follow.default": [
    "Chào mừng {name} vừa theo dõi kênh!",
    "{name} đã gia nhập hội, welcome nhé!"
  ]
}
```

### Tone

MVP hỗ trợ profile template:

- `polite`
- `gamer`
- `funny`
- `light_roast`

Không dùng AI generation ở v0.1.1. Template giúp:

- Kiểm soát nội dung.
- Độ trễ thấp.
- Chi phí thấp.
- Tránh câu thoại không phù hợp.

### Voice interrupt policy

Profile voice chọn một trong ba mode:

- `never_interrupt`: không cắt clip đang phát; mặc định.
- `interrupt_lower_priority`: job mới chỉ cắt clip có priority thấp hơn.
- `interrupt_any`: job mới có thể cắt mọi clip; dành cho cảnh báo đặc biệt.

Khi interrupt, playback client fade-out 100–250 ms, báo trạng thái `interrupted` và chuyển sang job mới. Job bị interrupt không tự replay.

---

## 11.11 Name Normalizer

Thứ tự chọn tên:

1. Pronunciation override.
2. Nickname.
3. Unique username.
4. Fallback chung.

Các bước:

- Unicode normalize.
- Bỏ emoji nếu provider đọc kém.
- Thay `_`, `.`, `-` bằng khoảng trắng.
- Bỏ chuỗi số dài.
- Giới hạn 30 ký tự.
- Chặn từ cấm.
- Chặn text giống URL.
- Chặn tên có lệnh hoặc markup.
- Có danh sách alias.

Ví dụ:

```json
{
  "match": "dquangminh_2k6",
  "pronunciation": "Quang Minh"
}
```

Fallback:

- “một vị đại ca”
- “một người chơi”
- “một thành viên trong phòng”
- “người bạn bí ẩn”

Không nên đọc username nguyên bản khi:

- Quá dài.
- Chứa nhiều số.
- Chứa từ không phù hợp.
- Chứa URL.
- Không qua moderation.

---

## 11.12 Priority Queue cho voice

Mức ưu tiên gợi ý:

| Loại | Priority |
|---|---:|
| System error quan trọng | 100 |
| Gift giá trị lớn | 95 |
| Boss/game milestone | 90 |
| Gift thường | 80 |
| Follow | 50 |
| Join | 20 |
| Comment TTS được duyệt | 10 |

Quy tắc:

- Quyền cắt clip đang phát tuân theo `interruptPolicy`; mặc định `never_interrupt`.
- Queue tối đa 30 item.
- Khi queue đầy, loại item priority thấp nhất.
- Job hết hạn thì bỏ.
- Gift cùng user/gift được merge.
- Follow có global cooldown.
- Join mặc định không đọc từng người.

---

## 11.13 TTS Provider

```ts
interface TtsProvider {
  readonly id: string;
  listVoices(): Promise<TtsVoice[]>;
  synthesize(request: TtsRequest): Promise<TtsResult>;
  healthCheck(): Promise<ProviderHealth>;
}
```

Implementations dự kiến:

- `EdgeTtsProvider`
- `SystemTtsProvider`
- `CloudTtsProvider`
- `MockTtsProvider`

`TtsRequest`:

```json
{
  "text": "Cảm ơn Minh đã tặng năm bông hồng!",
  "voiceId": "vi-VN-default",
  "rate": 1.05,
  "pitch": 0,
  "volume": 1,
  "format": "mp3"
}
```

### Cache

Cache key:

```text
provider + voice + rate + pitch + normalizedText
```

Không cache câu chứa thông tin nhạy cảm. Cache local có TTL và giới hạn dung lượng.

---

## 11.14 Audio Playback

Đề xuất dùng một browser source:

```text
http://127.0.0.1:3100/output/voice
```

Trang này:

- Kết nối `/voice-output`.
- Nhận audio job ready.
- Phát tuần tự.
- Gửi `playback.started`.
- Gửi `playback.finished`.
- Có watchdog nếu audio bị treo.
- Không hiển thị UI hoặc có overlay subtitle tùy chọn.

Lợi ích:

- OBS có thể capture trực tiếp.
- Không cần virtual audio cable cho MVP.
- Dễ điều chỉnh volume tại source.
- Tách audio khỏi dashboard.

Rủi ro:

- Autoplay policy của browser.
- Cần một lần tương tác hoặc cấu hình browser source phù hợp.
- Cần test riêng với TikTok LIVE Studio.

---

## 11.15 Dashboard

### Trang Connection

- Runtime session status và nút revoke paired clients.
- Username.
- Connector type.
- Connect/disconnect.
- Status.
- Room info.
- Reconnect count.
- Last event time.

### Trang Event Monitor

- Live event feed.
- Filter theo type.
- Pause UI.
- Copy normalized JSON.
- Hiển thị raw debug chỉ khi bật developer mode.

### Trang Games

- Danh sách manifest.
- Active game.
- Game status.
- Open game URL.
- Pause action.
- Test action trực tiếp.

### Trang Mappings

- Rule builder.
- Gift selector.
- Action selector từ manifest.
- Parameter mapping.
- Cooldown.
- Rate limit.
- Enable/disable.
- Test rule.

### Trang Voice

- Bật/tắt.
- Interrupt policy.
- Voice provider.
- Voice.
- Rate/pitch/volume.
- Tone.
- Queue status.
- Clear queue.
- Test sentence.

### Trang Templates

- Template groups.
- Preview.
- Random sample.
- Biến hợp lệ.
- Import/export.

### Trang Pronunciation

- Username/nickname matcher.
- Text đọc thay thế.
- Enable/disable.

### Trang Simulator

- Chọn event.
- User.
- Gift.
- Quantity.
- Comment.
- Emit once.
- Burst test.
- Scenario test.

---

## 12. Data contracts

## 12.1 LiveEventEnvelope

```ts
interface LiveEventEnvelope<TPayload = unknown> {
  specVersion: "0.1";
  eventId: string;
  eventType: LiveEventType;
  source: "tiktok" | "tikfinity" | "mock";
  room: {
    roomId: string | null;
    streamerUniqueId: string;
  };
  user: {
    id: string | null;
    uniqueId: string | null;
    displayName: string;
    avatarUrl: string | null;
    roles: string[];
  } | null;
  payload: TPayload;
  occurredAt: string;
  receivedAt: string;
  metadata: {
    connectorId: string;
    connectorVersion?: string;
    sequenceId?: string;
    isReplay: boolean;
    rawStored: boolean;
  };
}
```

### Gift payload

```ts
interface GiftSentPayload {
  gift: {
    id: string;
    name: string;
    imageUrl: string | null;
    diamondValue: number | null;
    streakable: boolean;
  };
  quantity: number;
  totalQuantity: number;
  streak: {
    id: string | null;
    status: "single" | "start" | "update" | "end";
  };
  estimatedDiamondTotal: number | null;
}
```

### Comment payload

```ts
interface ChatCommentPayload {
  text: string;
  textNormalized: string;
  mentions: string[];
}
```

### Like payload

```ts
interface LikePayload {
  delta: number;
  total: number | null;
  milestone: number | null;
}
```

---

## 12.2 GameActionEnvelope

```ts
interface GameActionEnvelope<TParams = unknown> {
  specVersion: "0.1";
  actionId: string;
  actionType: string;
  gameId: string;
  gameInstanceId: string | null;
  params: TParams;
  actor: {
    viewerId: string | null;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  trigger: {
    eventId: string;
    eventType: string;
    mappingId: string;
  };
  priority: number;
  ttlMs: number;
  createdAt: string;
}
```

---

## 12.3 VoiceIntent

```ts
interface VoiceIntent {
  specVersion: "0.1";
  intentId: string;
  eventId: string | null;
  kind: "thank_gift" | "welcome_follow" | "game_commentary" | "system";
  priority: number;
  templateGroup: string;
  variables: Record<string, string | number>;
  voiceProfileId: string;
  dedupeKey: string | null;
  expiresAt: string;
}
```

---

## 13. API design

Base URL:

```text
http://127.0.0.1:3100/api/v1
```

### Authentication và pairing

```http
POST /auth/pairing-codes
POST /auth/pair
GET  /auth/clients
DELETE /auth/clients/:clientId
POST /auth/revoke-all-non-admin
```

Admin endpoint dùng same-origin session cookie + CSRF protection. Pair endpoint chỉ nhận request loopback và one-time code.

### Connector

```http
POST /connectors/tiktok/connect
POST /connectors/tiktok/disconnect
GET  /connectors/tiktok/status
```

Connect body:

```json
{
  "uniqueId": "streamer_name",
  "connectorId": "tiktok-live-connector"
}
```

### Events

```http
GET  /events?type=gift.sent&limit=100
POST /events/mock
```

### Games

```http
GET  /games
GET  /games/:gameId
POST /games/:gameId/activate
POST /games/:gameId/pause
POST /games/:gameId/test-action
```

### Mappings

```http
GET    /mappings
POST   /mappings
PUT    /mappings/:id
DELETE /mappings/:id
POST   /mappings/:id/test
```

### Voice

```http
GET  /voice/settings
PUT  /voice/settings
GET  /voice/queue
POST /voice/queue/clear
POST /voice/test
```

### Templates và pronunciation

```http
GET    /voice/templates
POST   /voice/templates
PUT    /voice/templates/:id
DELETE /voice/templates/:id

GET    /voice/pronunciations
POST   /voice/pronunciations
PUT    /voice/pronunciations/:id
DELETE /voice/pronunciations/:id
```

### System

```http
GET  /health
GET  /diagnostics
GET  /diagnostics/metrics
POST /system/pause
POST /system/resume
```

---

## 14. WebSocket protocol

Namespaces hoặc paths:

```text
/ws/admin
/ws/game
/ws/voice-output
```

### Admin events

Server → dashboard:

- `system.status`
- `connector.status`
- `live.event`
- `game.status`
- `game.action`
- `voice.queue`
- `log.entry`

### Game handshake

Client → server:

```json
{
  "type": "game.register",
  "gameId": "zombie-survival",
  "instanceId": "instance-uuid",
  "sdkVersion": "0.1",
  "token": "opaque-runtime-role-token"
}
```

Server → client:

```json
{
  "type": "game.registered",
  "heartbeatIntervalMs": 5000
}
```

### Action

Server → game:

```json
{
  "type": "game.action",
  "data": {
    "actionId": "act_123",
    "actionType": "SPAWN_ZOMBIE",
    "params": {
      "amount": 5,
      "ownerName": "Quang Minh"
    },
    "ttlMs": 10000
  }
}
```

Game → server receipt:

```json
{
  "type": "game.action.received",
  "actionId": "act_123",
  "receivedAt": "2026-07-20T04:00:00.250Z"
}
```

Game → server result:

```json
{
  "type": "game.action.result",
  "actionId": "act_123",
  "status": "completed",
  "durationMs": 2840
}
```

### Voice output

Server → browser source:

```json
{
  "type": "voice.play",
  "jobId": "voice_123",
  "audioUrl": "/media/tts/voice_123.mp3",
  "subtitle": "Cảm ơn Minh đã tặng 5 bông hồng!",
  "volume": 1
}
```

---

## 15. Storage design

SQLite tables:

### `app_settings`

- `key`
- `value_json`
- `updated_at`

### `connector_profiles`

- `id`
- `type`
- `name`
- `config_json`
- `created_at`
- `updated_at`

### `game_manifests`

- `game_id`
- `version`
- `manifest_json`
- `enabled`
- `updated_at`

### `game_profiles`

- `id`
- `game_id`
- `name`
- `settings_json`
- `is_active`

### `event_mappings`

- `id`
- `game_profile_id`
- `name`
- `event_type`
- `priority`
- `conditions_json`
- `transform_json`
- `controls_json`
- `enabled`
- `created_at`
- `updated_at`

### `voice_profiles`

- `id`
- `name`
- `provider_id`
- `voice_id`
- `settings_json`
- `enabled`

### `voice_templates`

- `id`
- `group_key`
- `tone`
- `template`
- `weight`
- `enabled`

### `pronunciation_rules`

- `id`
- `matcher_type`
- `pattern`
- `replacement`
- `priority`
- `enabled`

### `event_logs`

- `event_id`
- `event_type`
- `source`
- `summary_json`
- `occurred_at`
- `received_at`

MVP chỉ giữ rolling log, ví dụ 10.000 event hoặc 7 ngày.

### `action_logs`

- `action_id`
- `event_id`
- `mapping_id`
- `game_id`
- `status`
- `retry_count`
- `created_at`
- `sent_at`
- `received_at`
- `completed_at`
- `failure_code`

Runtime sessions và raw token không lưu trong SQLite. Chỉ có thể lưu audit metadata không nhạy cảm như client ID, role, paired/revoked timestamp và token fingerprint.

### `voice_jobs`

- `job_id`
- `intent_id`
- `priority`
- `text`
- `provider_id`
- `status`
- `audio_path`
- `error`
- `created_at`
- `finished_at`

---

## 16. Luồng xử lý chính

## 16.1 Gift → game action → voice

```text
Viewer gửi Rose ×5
        │
        ▼
Connector nhận raw gift updates
        │
        ▼
Normalizer tạo gift.sent
        │
        ▼
Deduper xác nhận không trùng
        │
        ├──────────────► Mapping Engine
        │                   │
        │                   ▼
        │              SPAWN_ZOMBIE ×5
        │                   │
        │                   ▼
        │              Action Gateway
        │                   │
        │                   ▼
        │                  Game
        │
        └──────────────► Voice Engine
                            │
                            ▼
                    Aggregate 3 giây
                            │
                            ▼
                  “Cảm ơn Minh...”
                            │
                            ▼
                         TTS
                            │
                            ▼
                  Voice browser source
```

Game action không chờ voice hoàn thành.

---

## 16.2 Mock event

```text
Dashboard Simulator
       ↓
POST /events/mock
       ↓
MockConnector / Event Factory
       ↓
Normalizer
       ↓
Toàn bộ pipeline thật
```

Mock event phải có badge rõ ràng để tránh nhầm với donate thật.

---

## 16.3 Connector mất kết nối

```text
Connection lost
      ↓
Status = RECONNECTING
      ↓
Mapping tạm dừng nhận event mới
      ↓
Backoff + retry
      ↓
Connected
      ↓
Status = CONNECTED
```

Không replay event cũ mặc định sau reconnect, vì có nguy cơ kích hoạt gameplay trùng. Open gift streak được finalize incomplete theo `disconnect_flush`.

## 16.4 Đổi active game

```text
Switch requested
      ↓
Freeze mappings của game cũ
      ↓
Drain receipt ACK tối đa 2 giây
      ↓
Cancel unsent actions
      ↓
Atomic profile switch
      ↓
Activate game mới
```

Nếu game mới chưa ready và `strictSwitch = true`, transaction bị rollback và game cũ tiếp tục active.

---

## 17. Spam, moderation và fairness

### Gift spam

- Merge cùng user + gift trong cửa sổ 3 giây cho voice.
- Game mapping có thể giữ realtime nếu gameplay cần.
- Áp dụng per-user, per-rule và per-game global action budget.
- Khi global budget đầy, drop/coalesce theo priority và policy; không queue vô hạn.

### Comment spam

- Cooldown theo user.
- Whitelist command.
- Normalize chữ hoa/thường và dấu cách.
- Không cho regex quá phức tạp từ dashboard nếu không validate.
- Không đọc comment tự do bằng TTS mặc định.

### Username abuse

- Profanity filter.
- URL filter.
- Max length.
- Pronunciation override.
- Generic fallback.

### High-value gift

Không tin hoàn toàn vào `giftName`. Rule nên ưu tiên `giftId`; giá trị diamond chỉ dùng khi connector cung cấp đáng tin cậy.

---

## 18. Runtime lifecycle, shutdown và error handling

## 18.1 Graceful shutdown

Khi nhận SIGINT, app close hoặc shutdown request:

1. Chuyển system status thành `SHUTTING_DOWN`.
2. Ngừng nhận connect mới và ngừng tạo game action mới.
3. Flush/finalize open gift streak với `endReason = shutdown_flush`.
4. Chờ receipt ACK cho action đã send tối đa 2 giây.
5. Mark action chưa receipt là `delivery_unknown`; không replay tự động ở lần chạy sau.
6. Dừng nhận voice intent mới.
7. Cho clip đang phát hoàn tất tối đa 3 giây hoặc interrupt theo shutdown policy.
8. Mark voice job còn lại là `cancelled_shutdown`.
9. Flush structured logs và commit SQLite transaction.
10. Revoke runtime sessions và đóng process.

Shutdown có hard deadline mặc định 8 giây; quá deadline thì force close sau khi ghi crash marker nếu có thể.

## 18.2 Startup reconciliation và crash recovery

Khi khởi động:

- Tạo runtime secret và session registry mới.
- Chạy database migration trong transaction.
- Kiểm tra action/voice records không ở terminal state.
- Không replay gameplay action từ phiên trước.
- Action `CREATED`, `SENT` hoặc `RECEIVED` còn mở được mark `aborted_restart` hoặc `delivery_unknown_restart` tùy trạng thái cuối.
- Voice job `synthesizing` được mark `failed_recoverable`; job `playing` được mark `interrupted_restart`.
- Open streak runtime không tồn tại sau crash; nếu có persisted diagnostic record thì mark `aborted_restart`, không tự tạo gift final mới.
- Active game profile được restore về config nhưng trạng thái runtime là `PAUSED` cho tới khi game instance register lại.
- Connector không auto-connect trừ khi setting `autoConnect = true`; nếu auto-connect vẫn phải đi qua state machine bình thường.

Mục tiêu recovery là tránh duplicate gameplay, không cố đạt exactly-once qua process restart.

## 18.3 CORS, origin và loopback policy

- Production dashboard: same-origin với backend.
- Dev dashboard: chỉ whitelist origin cấu hình, ví dụ `http://127.0.0.1:5173` và `http://localhost:5173`.
- Game/voice browser sources có origin whitelist theo manifest/config.
- Không dùng `Access-Control-Allow-Origin: *` cho admin API.
- HTTP server mặc định listen `127.0.0.1`, không listen `0.0.0.0`.
- WebSocket kiểm tra Origin và role token; OBS browser source không được miễn authentication chỉ vì chạy local.
- Cho phép `Origin: null` chỉ khi có explicit setting và valid role token, vì một số embedded browser có thể gửi null origin.

## 18.4 Error handling

### Connector error

- Log structured error.
- Chuyển trạng thái.
- Reconnect.
- Dashboard alert.

### Invalid event

- Drop.
- Tăng metric.
- Lưu sample debug nếu developer mode.

### Mapping error

- Disable rule sau nhiều lỗi liên tiếp.
- Không crash event bus.
- Hiển thị rule ID gây lỗi.

### Game action error

- Retry.
- Mark failed.
- Không chuyển thành voice error.

### TTS error

- Retry một lần.
- Chuyển provider fallback nếu cấu hình.
- Nếu vẫn lỗi: subtitle-only hoặc skip.
- Không block queue vô hạn.

### Audio playback error

- Timeout.
- Mark failed.
- Chuyển job tiếp theo.
- Dashboard cho replay thủ công.

---

## 19. Testing strategy

## 19.1 Unit tests

- Event normalization.
- Event-specific fingerprint/deduplication.
- Comment duplicate window không drop comment hợp lệ.
- Gift combo aggregation, inactivity timeout và disconnect flush.
- Rule operators, specificity và deterministic tie-break.
- Template rendering.
- Name normalization.
- Moderation.
- Priority queue.
- Receipt retry và completion result semantics.
- Token pairing, role validation và revocation.
- Global action budget.
- Schema validation.

## 19.2 Contract tests

Mỗi connector adapter dùng fixture raw event và phải output đúng `LiveEventEnvelope`.

Mỗi game manifest phải validate action payload.

## 19.3 Integration tests

- Mock gift → action.
- Mock gift → voice.
- Comment → team join.
- Duplicate gift → một action.
- Hai comment giống nhau ngoài dedup window → hai event.
- Gift combo thiếu END → finalize bằng timeout và một voice message.
- Receipt ACK timeout → retry cùng action ID.
- Completion lâu hơn 1 giây → không retry sau receipt.
- Active game switch → không leak action sang game mới.
- Server restart → không replay action cũ.
- TTS failure → fallback.
- Connector reconnect.

## 19.4 End-to-end tests

- Chạy backend.
- Chạy dashboard.
- Chạy demo Phaser game.
- Chạy voice output browser.
- Emit scenario.
- Xác nhận game và audio.

## 19.5 Load tests

- 100 event/giây trong 60 giây.
- 1.000 like update được aggregate.
- 100 gift từ nhiều user.
- Voice queue saturation.
- Game disconnect/reconnect liên tục.
- Nhiều rule cùng match để kiểm tra global action budget.

---

## 20. Deployment

### Development

```text
pnpm install
pnpm dev
```

Processes:

- Backend API/WebSocket: `3100`
- Dashboard Vite: `5173`
- Demo game: `5174`

### MVP production local

Một launcher chạy:

- Backend.
- Dashboard static files.
- Media cache.
- SQLite.

Sau này đóng gói bằng:

- Tauri, hoặc
- Electron, hoặc
- Windows installer chạy Node service.

### OBS/TikTok LIVE Studio sources

1. Game browser source.
2. Voice output browser source.
3. Optional alert/subtitle overlay.
4. Optional dashboard không đưa lên stream.

---

## 21. Cấu trúc repository

```text
crowdcircuit/
├── apps/
│   ├── server/
│   ├── dashboard/
│   ├── voice-output/
│   └── demo-game/
│
├── packages/
│   ├── contracts/
│   ├── connector-core/
│   ├── connector-tiktok/
│   ├── connector-tikfinity/
│   ├── connector-mock/
│   ├── event-core/
│   ├── auth-core/
│   ├── mapping-engine/
│   ├── voice-engine/
│   ├── tts-core/
│   ├── game-sdk-js/
│   └── shared/
│
├── games/
│   └── zombie-survival/
│       ├── game.manifest.json
│       └── default-profile.json
│
├── data/
│   ├── app.db
│   ├── logs/
│   └── media/
│
├── docs/
│   ├── crowdcircuit-system-design-v0.1.1.md
│   ├── event-contract.md
│   ├── game-sdk.md
│   └── connector-notes.md
│
├── pnpm-workspace.yaml
└── package.json
```

---

## 22. Technology stack đề xuất

| Thành phần | Công nghệ |
|---|---|
| Runtime | Node.js + TypeScript |
| Monorepo | pnpm workspace |
| HTTP API | Fastify |
| WebSocket | Socket.IO hoặc native `ws` |
| Runtime validation | Zod |
| Dashboard | React + Vite |
| State/query | TanStack Query |
| Database | SQLite |
| ORM/query builder | Drizzle ORM |
| Logging | Pino |
| Local auth | Opaque in-memory role tokens + one-time pairing code |
| Tests | Vitest |
| E2E | Playwright |
| Game demo | Phaser |
| TTS | Provider adapter; Edge/System/Cloud |
| Packaging sau MVP | Tauri hoặc Electron |

### Socket.IO hay native WebSocket?

Đề xuất v0.1: **Socket.IO**.

Lý do:

- Reconnect sẵn.
- ACK tiện.
- Namespace.
- Dễ dùng ở browser.
- Debug nhanh.

Sau này có thể chuyển protocol sang WebSocket chuẩn nếu cần hỗ trợ nhiều engine hơn.

---

## 23. Milestones triển khai

## Milestone 1 — Event Gateway

Deliverables:

- Monorepo.
- Backend.
- TikTok connector.
- Mock connector.
- Event normalizer.
- Event monitor console.
- Reconnect.
- Unit tests cơ bản.

Acceptance:

- Connect được một room LIVE.
- Log được comment và gift.
- Mock event chạy được.
- Connector mất kết nối không crash app.

## Milestone 2 — Dashboard và normalized event

Deliverables:

- Dashboard connection.
- Event monitor.
- SQLite.
- Export normalized JSON.
- Diagnostics.

Acceptance:

- Người dùng connect/disconnect từ UI.
- Event hiển thị real-time.
- Config được lưu sau restart.

## Milestone 3 — Mapping Engine và demo game

Deliverables:

- Rule engine.
- Game manifest.
- Game SDK JS.
- Demo Phaser game.
- Receipt ACK, completion result và delivery retry.
- Deterministic rule conflict resolution.
- Global action budget.
- Active-game transition.
- Simulator.

Acceptance:

- Rose mock → spawn zombie.
- Comment `team đỏ` → join red team.
- Game reconnect không double-process action đã `received`.
- Animation kéo dài không làm server retry sau receipt.
- Hai rule cùng priority cho kết quả deterministic.
- Switch game không gửi action cũ sang game mới.

## Milestone 4 — Voice Reaction Engine

Deliverables:

- Name normalizer.
- Templates.
- Voice rules.
- Aggregation.
- Priority queue.
- TTS adapter.
- Voice output browser source.

Acceptance:

- Gift combo được cảm ơn một lần.
- Tên được đọc theo pronunciation rule.
- Gift lớn ưu tiên trước follow.
- Queue có thể mute, clear và áp dụng interrupt policy.
- Gift streak thiếu END vẫn được finalize bằng inactivity timeout.

## Milestone 5 — Hardening

Deliverables:

- Load tests.
- Graceful shutdown và startup reconciliation.
- Local session pairing/revocation hardening.
- Metrics JSON endpoint.
- CORS/origin matrix.
- Log viewer.
- Profile import/export.
- Packaging thử nghiệm.

Acceptance:

- Chạy ổn định một phiên LIVE dài.
- Burst event không treo UI.
- TTS lỗi không ảnh hưởng gameplay.
- Có hướng dẫn setup OBS/TikTok LIVE Studio.
- Restart app không replay action gameplay cũ.
- Token cũ mất hiệu lực sau server restart.

---

## 24. Tiêu chí hoàn thành MVP v0.1.1

MVP được coi là hoàn thành khi:

- [ ] Kết nối được một TikTok LIVE.
- [ ] Nhận gift và comment.
- [ ] Event được chuẩn hóa.
- [ ] Có mock event.
- [ ] Có dashboard local.
- [ ] Có ít nhất một game demo.
- [ ] Có mapping gift → action.
- [ ] Có mapping comment → action.
- [ ] Có receipt ACK, completion result và dedupe action.
- [ ] Có deterministic rule conflict resolution.
- [ ] Có global action budget.
- [ ] Có local token pairing theo role.
- [ ] Có active-game transition.
- [ ] Có voice cảm ơn gift.
- [ ] Có đọc tên và pronunciation override.
- [ ] Có gift aggregation.
- [ ] Có priority queue.
- [ ] Có mute/clear voice.
- [ ] Có reconnect và gift streak timeout/flush.
- [ ] Có graceful shutdown và startup reconciliation.
- [ ] Có log và diagnostics.
- [ ] Có export/import config.
- [ ] Chạy được qua OBS hoặc TikTok LIVE Studio.

---

## 25. Rủi ro và phương án giảm thiểu

### R1 — TikTok thay đổi protocol

**Mức độ:** Cao.

**Giảm thiểu:**

- Adapter boundary.
- Contract tests.
- TikFinity adapter dự phòng.
- Managed API cho production.
- Không để raw type lan vào core.

### R2 — License connector

**Mức độ:** Trung bình đến cao nếu thương mại hóa.

**Giảm thiểu:**

- Rà soát license trước khi phân phối.
- Không mặc định coi thư viện reverse-engineered là phù hợp cho closed-source commercial app.
- Có phương án managed API.
- Giữ connector thành package độc lập.

### R3 — Gift bị tính trùng

**Mức độ:** Cao.

**Giảm thiểu:**

- Streak state có inactivity timeout và disconnect flush.
- Event-specific dedup strategy.
- Idempotent action IDs với receipt/result tách biệt.
- Fixture test với gift combo.

### R4 — Voice queue quá dài

**Mức độ:** Cao trong phòng đông.

**Giảm thiểu:**

- Aggregation.
- Priority.
- TTL.
- Queue cap.
- Drop policy.
- Cooldown.

### R5 — Username độc hại

**Mức độ:** Trung bình.

**Giảm thiểu:**

- Moderation.
- Sanitization.
- Generic fallback.
- Không đọc comment tự do.

### R6 — Audio không được capture

**Mức độ:** Trung bình.

**Giảm thiểu:**

- Voice browser source.
- Test matrix OBS/TikTok LIVE Studio.
- Fallback system audio output.
- Setup wizard ở phiên bản sau.

### R7 — Game lag khi burst event

**Mức độ:** Trung bình.

**Giảm thiểu:**

- Rate limit.
- Batch action.
- Game-side queue.
- Per-rule và global action budget.
- Deterministic overflow policy.
- Không spawn không giới hạn.

---

## 26. Open questions cho v0.2

Các câu hỏi không chặn v0.1:

1. Có đóng gói thành ứng dụng desktop ngay hay giữ dạng local web?
2. Có cần hỗ trợ nhiều game cùng lúc?
3. Gift value có dùng diamond hay chỉ gift ID?
4. Có cho streamer dùng AI sinh lời thoại?
5. Có cần overlay subtitle đi kèm TTS?
6. Có hỗ trợ comment TTS với moderation?
7. Có cần lưu leaderboard người donate?
8. Có cần cloud sync profile?
9. Có cần SDK Unity/Godot?
10. Sản phẩm chỉ dùng cá nhân hay phân phối thương mại?

---

## 27. Đề xuất mặc định cho lần triển khai đầu tiên (v0.1.1)

Để tránh over-engineering, bản đầu nên chốt:

- Node.js + TypeScript.
- Fastify.
- Socket.IO.
- React + Vite.
- SQLite + Drizzle.
- `tiktok-live-connector` cho prototype.
- `MockConnector` là thành phần bắt buộc.
- Một game Phaser demo.
- Template voice tĩnh.
- Một TTS provider và một mock provider.
- Browser source cho voice output.
- Không login.
- Không cloud.
- Không Docker trong vòng lặp phát triển local đầu tiên.
- Không microservice.
- Không AI generation.

---

## 28. Kết luận

CrowdCircuit nên được xây như một **event gateway có plugin boundary**, không phải một game gắn cứng với TikTok.

Ba contract quan trọng nhất là:

```text
LiveEventEnvelope
        ↓
GameActionEnvelope
        ↓
VoiceIntent
```

Nếu ba contract này ổn định, hệ thống có thể:

- Thay TikTok connector.
- Cắm thêm game.
- Thay TTS provider.
- Thêm overlay.
- Hỗ trợ nền tảng livestream khác.
- Mở rộng thành sản phẩm cho nhiều streamer.

Trọng tâm của v0.1 không phải tạo game thật phức tạp, mà là chứng minh pipeline sau chạy ổn định:

```text
TikTok/Mock Event
      → Normalize
      → Deduplicate
      → Map
      → Game Action
      → Voice Reaction
      → TTS Playback
```

---

## Phụ lục A — Nguồn tham khảo được kiểm tra

- TikTok for Developers — Webhook Events.
- GitHub — `zerodytrash/TikTok-Live-Connector`.
- GitHub — `isaackogan/TikTokLive`.
- TikFinity — TikTok LIVE API/WebSocket documentation.

**Lưu ý:** Tình trạng API, connector, license và chính sách nền tảng phải được kiểm tra lại trước khi phát hành sản phẩm thương mại.
