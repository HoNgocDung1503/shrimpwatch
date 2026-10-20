# 🦐 ShrimpWatch — Giải pháp Giám sát Ao nuôi Tôm Thông minh

> Dự án tham gia **Mini Hackathon Sep 2026** (MUG Vietnam).
> **ShrimpWatch** là hệ thống giám sát IoT toàn diện dành cho trang trại nuôi tôm, kết hợp sức mạnh của **MongoDB Time Series** để quản lý dữ liệu cảm biến và **Datadog** để quan sát, cảnh báo sự cố theo thời gian thực.

---

## 📖 Mục lục
1. [Giới thiệu Dự án](#-giới-thiệu-dự-án)
2. [Hướng dẫn Cài đặt & Khởi chạy](#-hướng-dẫn-cài-đặt--khởi-chạy)
3. [Hướng dẫn Sử dụng & Vận hành](#-hướng-dẫn-sử-dụng--vận-hành)
4. [Kịch bản Demo Sự cố (Incident Lifecycle)](#-kịch-bản-demo-sự-cố-incident-lifecycle)
5. [Đối chiếu Yêu cầu Kỹ thuật (BTC Compliance)](#-đối-chiếu-yêu-cầu-kỹ-thuật-btc-compliance)
6. [Danh mục Bằng chứng (Assets Proof)](#-danh-mục-bằng-chứng-assets-proof)
7. [Công nghệ Sử dụng](#-công-nghệ-sử-dụng)

---

## 🌟 Giới thiệu Dự án

ShrimpWatch mô phỏng một trang trại với **6 ao nuôi**, nơi các chỉ số môi trường được cập nhật liên tục mỗi 30 giây:
- **Cảm biến IoT:** Nhiệt độ, Độ pH, Oxy hòa tan (DO).
- **Thiết bị vận hành:** Công suất quạt nước (Pump Power).
- **Dữ liệu thủ công:** Độ kiềm (Alkalinity) được nhập từ kết quả test-kit.
- **Chỉ số tính toán:** Nồng độ CO₂ hòa tan (được tính toán tự động từ pH và Độ kiềm).

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### 🛠 Yêu cầu tiên quyết
- **Docker Desktop** (phiên bản mới nhất).
- **Git** để quản lý mã nguồn.
- **RAM ≥ 8 GB** để chạy mượt mà 5 dịch vụ (containers).
- **Tài khoản MongoDB Atlas** (miễn phí) — chỉ cần nếu muốn lưu dữ liệu trên Cloud thay vì trên máy.

### Bước 1: Chuẩn bị môi trường
Mở Terminal (PowerShell trên Windows) và thực hiện:
```powershell
# Tạo file cấu hình môi trường từ mẫu
copy .env.example .env
```

Sau đó mở file `.env` vừa tạo và điền các giá trị sau:

| Biến | Ý nghĩa | Lấy ở đâu |
|---|---|---|
| `MONGODB_URI` | Địa chỉ kết nối MongoDB | Mặc định là MongoDB chạy trong Docker. Đổi sang chuỗi `mongodb+srv://...` nếu dùng MongoDB Atlas (xem mục **3.3**) |
| `DD_API_KEY` | Khóa API của Datadog | Datadog → *Organization Settings* → *API Keys* |
| `DD_APP_KEY` | Khóa ứng dụng của Datadog | Datadog → *Organization Settings* → *Application Keys* |

> **Lưu ý:** Nếu chỉ muốn chạy thử trên máy, bạn có thể để nguyên `MONGODB_URI` mặc định và bỏ qua toàn bộ mục **3.3**. Hệ thống vẫn hoạt động đầy đủ.

### Bước 2: Khởi chạy hệ thống
Sử dụng Docker Compose để dựng toàn bộ hạ tầng:
```powershell
docker compose up -d --build
```
Chờ khoảng 30 giây để các dịch vụ khởi động hoàn tất. Kiểm tra trạng thái:
```powershell
docker compose ps
```
*Tất cả 5 dịch vụ phải ở trạng thái **Up**.*

| Dịch vụ | Nhiệm vụ |
|---|---|
| `shrimpwatch-api` | Máy chủ FastAPI — tiếp nhận dữ liệu và quản lý sự cố. |
| `shrimpwatch-simulator` | Mô phỏng 6 ao nuôi, gửi dữ liệu cảm biến mỗi 30 giây. |
| `shrimpwatch-worker` | Tự động phân tích dữ liệu, phát hiện và mở sự cố. |
| `shrimpwatch-mongodb` | MongoDB dự phòng chạy trên máy (chỉ dùng khi `.env` chưa trỏ lên Atlas). |
| `shrimpwatch-datadog` | Datadog Agent — thu thập metrics, logs và traces. |

### Bước 3: Khởi tạo dữ liệu
Thiết lập các bộ sưu tập (collections) trong MongoDB và tạo dữ liệu mẫu cho 6 ao nuôi:
```powershell
docker compose exec api python -m app.init_db
```
Khi khởi động, dịch vụ `simulator` còn tự động nạp lại **6 giờ dữ liệu lịch sử** vào MongoDB, giúp Dashboard và các cảnh báo có đủ dữ liệu nền để phân tích ngay lập tức.

---

## 🎮 Hướng dẫn Sử dụng & Vận hành

### 3.1. Quản lý API (Giao diện Swagger)
Truy cập: [http://localhost:8000/docs](http://localhost:8000/docs)

Tại đây bạn có thể:
- Xem danh sách ao nuôi (`GET /ponds`).
- Kiểm tra các sự cố đang diễn ra (`GET /incidents`).
- Xử lý sự cố bằng cách cập nhật trạng thái (`PATCH /incidents/{id}`).

Kiểm tra nhanh tình trạng hệ thống (API + kết nối database):
```powershell
curl http://localhost:8000/healthz
```
Kết quả mong đợi: `"status": "ok"` và `"mongo": true`.

### 3.2. Kiểm tra dữ liệu thô (MongoDB)
Sử dụng **MongoDB Compass** để kết nối và xem trực tiếp dữ liệu:

- **Nếu dùng MongoDB trong Docker (mặc định):**
  `mongodb://shrimp_app:shrimp_pass@localhost:27017/shrimpwatch?authSource=shrimpwatch`
- **Nếu dùng MongoDB Atlas (Cloud):** dán chuỗi `mongodb+srv://...` đã lấy ở mục **3.3** vào ô kết nối của Compass.

Sau khi kết nối, chọn database `shrimpwatch`, bạn sẽ thấy 4 bộ sưu tập:

| Bộ sưu tập | Nội dung |
|---|---|
| `metrics` | Dữ liệu chuỗi thời gian (Time Series) từ cảm biến. |
| `incidents` | Lịch sử chi tiết các sự cố và hành động xử lý. |
| `ponds` | Danh sách 6 ao nuôi và trạng thái quạt nước. |
| `events` | Nhật ký mọi thay đổi trạng thái của sự cố. |

> **Mẹo lấy bằng chứng:** Trong Compass, mở bộ sưu tập `metrics` → chọn tab **Indexes**. Bạn sẽ thấy chỉ mục `timestamp_1` có cột `Expire after` = `604800` giây (7 ngày) — đây là bằng chứng cho tiêu chí **Time Series + expireAfterSeconds**.

### 3.3. Đưa dữ liệu lên MongoDB Atlas (Cloud)
Thực hiện tuần tự các bước sau:

1. **Tạo cụm máy chủ (Cluster):** Đăng nhập [MongoDB Atlas](https://cloud.mongodb.com) → *Create* → chọn gói **M0 (Free)** → chọn khu vực gần Việt Nam (ví dụ *Singapore* hoặc *Hong Kong*) → *Create Deployment*.
2. **Tạo người dùng database:** Ở bước *Security Quickstart*, nhập **Username** và **Password**, rồi nhấn *Create User*. **Hãy lưu lại thông tin này.**
3. **Mở danh sách IP được phép:** Chọn *Add entries* → *Allow access from anywhere* (`0.0.0.0/0`) → *Finish and Close*. (Bắt buộc, nếu không Docker sẽ không kết nối được.)
4. **Lấy chuỗi kết nối:** Nhấn *Connect* → *Drivers* → copy chuỗi có dạng
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority`
5. **Điền vào file `.env`:** thay dòng `MONGODB_URI` hiện tại bằng chuỗi vừa copy (nhớ thay `<user>` và `<password>` bằng thông tin thật ở bước 2).
6. **Khởi động lại hệ thống:**
   ```powershell
   docker compose up -d
   ```
7. **Kiểm tra kết nối thành công:**
   ```powershell
   curl http://localhost:8000/healthz
   ```
   Nếu `"mongo": true` nghĩa là hệ thống đã ghi dữ liệu trực tiếp lên Cloud.

Nhờ thao tác này, dữ liệu của cả 6 ao sẽ chảy trực tiếp lên Atlas. Sau khoảng 2 phút, vào Atlas → *Browse Collections* → `shrimpwatch` → `metrics`, bạn sẽ thấy dữ liệu cảm biến đổ về liên tục.

> **Ghi chú kỹ thuật:** Chuỗi kết nối `mongodb+srv://` yêu cầu thư viện `dnspython`, đã được khai báo sẵn trong [requirements.txt](requirements.txt). Vì vậy khi đổi sang Atlas lần đầu, cần chạy `docker compose up -d --build` để cài bổ sung thư viện này.

### 3.4. Giám sát trên Datadog Cloud
Khi đã cấu hình Key thật, truy cập Dashboard của bạn trên Datadog để xem:
- Biểu đồ biến thiên oxy, nhiệt độ theo thời gian thực.
- Bản đồ nhiệt (Heatmap) so sánh hiệu suất giữa các ao.
- Các cảnh báo (Alerts) khi chỉ số môi trường vượt ngưỡng an toàn.

---

## 🚨 Kịch bản Demo Sự cố (Incident Lifecycle)

Đây là tính năng cốt lõi thể hiện khả năng phối hợp giữa MongoDB và Datadog.

**Luồng xử lý 4 bước:**
1.  **Phát hiện (Open):** Hệ thống tự động nhận diện quạt nước hỏng (Công suất < 50W) → Mở sự cố CRITICAL.
2.  **Điều tra (Investigating):** Kỹ thuật viên cập nhật trạng thái và ghi chú hành động kiểm tra thiết bị.
3.  **Xử lý (Resolving):** Thực hiện sửa chữa, thay thế linh kiện và khôi phục hoạt động của quạt.
4.  **Hồi phục (Recovered):** Hệ thống theo dõi chỉ số Oxy (DO). Khi DO ổn định trở lại (> 5mg/L), sự cố tự động đóng.

**Cách chạy Demo nhanh:**
```powershell
# Chạy script tự động hóa luồng sự cố trên ao số 3
docker compose exec api python -m app.demo_incident
```

---

## 📑 Đối chiếu Yêu cầu Kỹ thuật (BTC Compliance)

Dự án đáp ứng 100% các tiêu chí từ Ban tổ chức (BTC).

### 6.1 MongoDB (Nền tảng dữ liệu vận hành)

#### 🔴 Bắt buộc (6/6 tiêu chí)
| Yêu cầu BTC | Cách ShrimpWatch đáp ứng | Bằng chứng |
|---|---|---|
| **Nền tảng CHÍNH** | Toàn bộ dữ liệu sensor, sự cố và lịch sử vận hành lưu tại MongoDB Atlas (Cloud). | [13_mongodb_atlas_data.png](assets_proof/13_mongodb_atlas_data.png) |
| **Time Series Collections** | Dữ liệu telemetry (DO, pH, Nhiệt độ) lưu trong Time Series Collection. | [01_mongo_timeseries_ttl.png](assets_proof/01_mongo_timeseries_ttl.png) |
| **Aggregation & Window** | Dùng `$setWindowFields` phân tích xu hướng oxy trong cửa sổ 5 phút. | [worker.py](app/worker.py#L81) |
| **expireAfterSeconds** | Cấu hình TTL tự động xóa dữ liệu sensor cũ sau 7 ngày (604800 giây). | [01_mongo_timeseries_ttl.png](assets_proof/01_mongo_timeseries_ttl.png) |
| **Mô hình & Truy cập hiệu quả** | Thiết kế Document model tối ưu, đánh index trên metadata và timestamp. | [models.py](app/models.py) |
| **Gắn chặt với vận hành** | MongoDB điều khiển toàn bộ trạng thái sự cố (State Machine). | [04_swagger_ui_incidents.png](assets_proof/04_swagger_ui_incidents.png) |

#### 🟡 Tùy chọn
| Yêu cầu BTC | Cách ShrimpWatch đáp ứng | Bằng chứng |
|---|---|---|
| **Xử lý hướng sự kiện** | Lưu vết mọi thay đổi trạng thái sự cố vào collection `events` để phục vụ hậu kiểm. | [05_mongodb_event_log.png](assets_proof/05_mongodb_event_log.png) |
| **Change Streams / Khác** | Cấu trúc sẵn sàng để tích hợp Change Streams cho thông báo thời gian thực. | [db.py](app/db.py) |

---

### 6.2 Datadog (Quan sát & Cảnh báo)

#### 🔴 Bắt buộc (4/4 tiêu chí)
| Yêu cầu BTC | Cách ShrimpWatch đáp ứng | Bằng chứng |
|---|---|---|
| **Ít nhất 1 Dashboard** | Dashboard tổng quan sức khỏe 6 ao nuôi với đầy đủ chỉ số môi trường. | [07_datadog_dashboard.png](assets_proof/07_datadog_dashboard.png) |
| **Ít nhất 1 Monitor/Alert** | Cảnh báo CRITICAL khi quạt hỏng và WARNING khi oxy giảm bất thường. | [08_datadog_monitor_alert.png](assets_proof/08_datadog_monitor_alert.png) |
| **Năng lực bổ sung** | Tích hợp đồng thời APM, Log Management và Distributed Tracing. | [09_datadog_correlation_log_trace_metric.png](assets_proof/09_datadog_correlation_log_trace_metric.png) |
| **Kết nối Metrics/Logs/Traces** | Gắn `trace_id` xuyên suốt giúp điều tra sự cố từ cảnh báo đến mã nguồn. | [09_datadog_correlation_log_trace_metric.png](assets_proof/09_datadog_correlation_log_trace_metric.png) |

#### 🟡 Tùy chọn nâng cao
| Yêu cầu BTC | Cách ShrimpWatch đáp ứng | Bằng chứng |
|---|---|---|
| **Agent Observability** | Theo dõi sức khỏe hệ thống Agent qua `agent status` và `http_check`. | [03_agent_status.png](assets_proof/03_agent_status.png) |
| **AI Observability** | Sử dụng Watchdog Insights để tự động phát hiện các điểm bất thường trong log. | [09_datadog_correlation_log_trace_metric.png](assets_proof/09_datadog_correlation_log_trace_metric.png) |

---

## 📂 Danh mục Bằng chứng (Assets Proof)

Để nộp bài, hãy đảm bảo thư mục `assets_proof/` có đủ các tệp sau:

| STT | Tên file | Nội dung minh chứng |
|---|---|---|
| 1 | `01_mongo_timeseries_ttl.png` | Cấu hình Time Series và TTL trong MongoDB. |
| 2 | `02_pytest_9_xanh.png` | Kết quả chạy kiểm thử tự động (9/9 passed). |
| 3 | `03_agent_status.png` | Trạng thái hoạt động của Datadog Agent. |
| 4 | `04_swagger_ui_incidents.png` | Giao diện quản lý sự cố (Incident Management). |
| 5 | `05_mongodb_event_log.png` | Nhật ký sự kiện (Event Log) trong MongoDB. |
| 6 | `06_mongodb_document_incident.png` | Cấu trúc dữ liệu Document của sự cố. |
| 7 | `07_datadog_dashboard.png` | Dashboard tổng quan (Phần 1: KPI & Sức khỏe). |
| 8 | `07_datadog_dashboard_2.png` | Dashboard chi tiết (Phần 2: pH, Độ kiềm, Heatmap). |
| 9 | `07_datadog_dashboard_3.png` | Dashboard chi tiết (Phần 3: Nhiệt độ, Oxy). |
| 10 | `08_datadog_monitor_alert.png` | Cảnh báo đỏ (Alert) khi xảy ra sự cố hỏng quạt. |
| 11 | `09_datadog_correlation_log_trace_metric.png` | Truy vết Log ↔ Trace ↔ Metric trên Datadog. |
| 12 | `ShrimpWatch_Lifecycle.mp4` | Video demo trọn vẹn vòng đời sự cố. |
| 13 | `13_mongodb_atlas_cluster.png` | Cụm máy chủ MongoDB Atlas (Cloud, gói M0) đang hoạt động. |
| 14 | `14_mongodb_atlas_data.png` | Dữ liệu cảm biến của 6 ao chảy trực tiếp lên MongoDB Atlas. |

---

## 💻 Công nghệ Sử dụng

- **Backend:** FastAPI (Python 3.11), Pydantic v2.
- **Database:** MongoDB Atlas (Cloud, gói M0) — Time Series, Aggregation Pipeline, TTL Index.
- **Observability:** Datadog (DogStatsD, APM, Log Management).
- **DevOps:** Docker, Docker Compose, Makefile.

---
**Chúc bạn có một kỳ Hackathon thành công rực rỡ! 🏆🦐🚀**
