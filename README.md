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

### Bước 1: Chuẩn bị môi trường
Mở Terminal (PowerShell trên Windows) và thực hiện:
```powershell
# Tạo file cấu hình môi trường từ mẫu
copy .env.example .env
```
*(Lưu ý: Vào ngày 10/10, bạn cần điền DD_API_KEY và DD_APP_KEY thật từ Datadog vào file .env này)*

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

### Bước 3: Khởi tạo dữ liệu
Thiết lập các bộ sưu tập (collections) trong MongoDB và tạo dữ liệu mẫu cho 6 ao nuôi:
```powershell
docker compose exec api python -m app.init_db
```

---

## 🎮 Hướng dẫn Sử dụng & Vận hành

### 1. Quản lý API (FastAPI Swagger)
Truy cập: [http://localhost:8000/docs](http://localhost:8000/docs)
Tại đây bạn có thể:
- Xem danh sách ao nuôi (`GET /ponds`).
- Kiểm tra các sự cố đang diễn ra (`GET /incidents`).
- Xử lý sự cố bằng cách cập nhật trạng thái (`PATCH /incidents/{id}`).

### 2. Giám sát trên Datadog Cloud
Khi đã cấu hình Key thật, truy cập Dashboard của bạn trên Datadog để xem:
- Biểu đồ biến thiên oxy, nhiệt độ theo thời gian thực.
- Bản đồ nhiệt (Heatmap) so sánh hiệu suất giữa các ao.
- Các cảnh báo (Alerts) khi chỉ số môi trường vượt ngưỡng an toàn.

### 3. Kiểm tra dữ liệu thô (MongoDB)
Sử dụng **MongoDB Compass** để kết nối:
`mongodb://shrimp_app:shrimp_pass@localhost:27017/shrimpwatch?authSource=shrimpwatch`
- **metrics:** Dữ liệu chuỗi thời gian (Time Series) từ cảm biến.
- **incidents:** Lịch sử chi tiết các vụ việc và hành động xử lý.

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

Dự án đáp ứng 100% các tiêu chí bắt buộc và khuyến khích từ Ban tổ chức.

### 6.1 MongoDB (Lưu trữ & Phân tích)
| Yêu cầu BTC | Cách ShrimpWatch đáp ứng | Bằng chứng |
|---|---|---|
| **Nền tảng CHÍNH** | MongoDB lưu trữ toàn bộ dữ liệu sensor, sự cố và vận hành. | [01_mongo_timeseries_ttl.png](assets_proof/01_mongo_timeseries_ttl.png) |
| **Time Series** | Sử dụng Time Series Collection tối ưu cho dữ liệu cảm biến 30s. | [db.py](app/db.py#L62-L68) |
| **Aggregation Pipeline** | Dùng `$setWindowFields` tính tốc độ sụt oxy để cảnh báo sớm. | [worker.py](app/worker.py#L81) |
| **TTL Index** | Tự động xóa dữ liệu cũ sau 7 ngày để tiết kiệm tài nguyên. | [db.py](app/db.py#L69) |

### 6.2 Datadog (Giám sát & Cảnh báo)
| Yêu cầu BTC | Cách ShrimpWatch đáp ứng | Bằng chứng |
|---|---|---|
| **Dashboard** | Bảng điều khiển trực quan hiển thị sức khỏe của 6 ao nuôi. | [07_datadog_dashboard.png](assets_proof/07_datadog_dashboard.png) |
| **Monitor/Alert** | Tự động cảnh báo đỏ khi quạt hỏng hoặc oxy giảm nhanh. | [08_datadog_monitor_alert.png](assets_proof/08_datadog_monitor_alert.png) |
| **APM & Logs** | Truy vết chi tiết từ Log sang Trace để tìm nguyên nhân gốc rễ. | [09_datadog_correlation_log_trace_metric.png](assets_proof/09_datadog_correlation_log_trace_metric.png) |
| **Distributed Tracing** | Gắn trace_id vào mọi dòng log để kết nối dữ liệu vận hành. | [logging_setup.py](app/logging_setup.py) |

---

## 📂 Danh mục Bằng chứng (Assets Proof)

Để nộp bài, hãy đảm bảo thư mục `assets_proof/` có đủ các tệp sau:

| STT | Tên file | Nội dung minh chứng |
|---|---|---|
| 1 | `01_mongo_timeseries_ttl.png` | Cấu hình Time Series và TTL trong MongoDB. |
| 2 | `02_pytest_9_xanh.png` | Kết quả chạy kiểm thử tự động (9/9 passed). |
| 3 | `03_agent_status.png` | Trạng thái hoạt động của Datadog Agent. |
| 4 | `07_datadog_dashboard.png` | Dashboard tổng quan (Phần 1: KPI & Sức khỏe). |
| 5 | `07_datadog_dashboard_2.png` | Dashboard chi tiết (Phần 2: pH, Độ kiềm, Heatmap). |
| 6 | `07_datadog_dashboard_3.png` | Dashboard chi tiết (Phần 3: Nhiệt độ, Oxy). |
| 7 | `08_datadog_monitor_alert.png` | Cảnh báo đỏ (Alert) khi xảy ra sự cố hỏng quạt. |
| 8 | `09_datadog_correlation_log_trace_metric.png` | Truy vết Log ↔ Trace ↔ Metric trên Datadog. |
| 9 | `ShrimpWatch_Lifecycle.mp4` | Video demo trọn vẹn vòng đời sự cố. |

---

## 💻 Công nghệ Sử dụng

- **Backend:** FastAPI (Python 3.11), Pydantic v2.
- **Database:** MongoDB 7 (Time Series, Aggregation Pipeline).
- **Observability:** Datadog (DogStatsD, APM, Log Management).
- **DevOps:** Docker, Docker Compose, Makefile.

---
**Chúc bạn có một kỳ Hackathon thành công rực rỡ! 🏆🦐🚀**
