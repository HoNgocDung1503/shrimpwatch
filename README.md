# 🦐 ShrimpWatch — Hệ thống Giám sát Chất lượng Nước Ao Nuôi Tôm Thẻ Chân Trắng

> Dự án tham gia Mini Hackathon Sep 2026 (MUG Vietnam) — Đề tài: Giám sát IoT Ao nuôi tôm + tích hợp MongoDB Time Series + Datadog Observability.

---

## 📋 Nội dung

- [1. Tổng quan dự án](#1-tổng-quan-dự-án)
- [2. Ngưỡng chỉ tiêu theo đề tài](#2-ngưỡng-chỉ-tiêu-theo-đề-tài)
- [3. Kiến trúc hệ thống 5 Service](#3-kiến-trúc-hệ-thống-5-service)
- [4. Cấu trúc thư mục code](#4-cấu-trúc-thư-mục-code)
- [5. Hướng dẫn Cài đặt & Khởi động (Local Docker Compose)](#5-hướng-dẫn-cài-đặt--khởi-động-local-docker-compose)
- [6. 7 Yêu Cầu Nghiêm Thu (Definition of Done) và Bằng chứng](#6-7-yêu-cầu-nghiêm-thu-definition-of-done-và-bằng-chứng)
- [7. Các Phương Pháp Inspect Dữ liệu Hôm nay (07/10 - Không cần key Datadog)](#7-các-phương-pháp-inspect-dữ-liệu-hôm-nay-0710---không-cần-key-datadog)
- [8. 3 VIỆC CẦN LÀM NGÀY 10/10 (Key Trial Datadog Kích Hoạt)](#8-3-việc-cần-làm-ngày-1010-key-trial-datadog-kích-hoạt)
- [9. Tham khảo & Công nghệ](#9-tham-khảo--công-nghệ)

---

## 1. Tổng quan dự án

- **Tên dự án:** `ShrimpWatch`
- **Mô hình:** 1 Trang trại (farm-001) × **6 ao nuôi (pond-01 … pond-06)**
- **Nguồn dữ liệu:**
  | Loại metric | Nguồn | Tần suất | Mô tả |
  |---|---|---|---|
  | Nhiệt độ (°C), DO (mg/L), pH | Simulator (water_node) | 30 giây / lần / ao | Chu kỳ ngày/đêm hình sin (diurnal cycle) |
  | Công suất / trạng thái Quạt (pump_power W, pump_status bool) | Simulator (pump device) | 30 giây | Injectable: POST /ponds/{id}/pump/fail để làm hỏng quạt demo |
  | Độ kiềm Alkalinity (mg CaCO₃ / L) | Manual (Kỹ thuật viên test-kit) | 4 lần/ngày (0h, 6h, 12h, 18h) | source=manual |
  | CO₂ hòa tan (mg/L) | Worker tính toán (derived metric) | 30 giây | Công thức đề tài: CO₂ ≈ 44000 × (Alk / 50000) × 10^(6.35 − pH) |

- **Luồng Sự cố (Yêu cầu #7):**
  ```
  [Phát hiện] Worker phát hiện pump_power avg 5 phút < 50W → DO drop rate vượt ngưỡng
       ↓ auto-open incident
  [Điều tra]  PATCH /incidents/{id} state=investigating + action="Kiểm tra điện/máy quạt"
       ↓ sửa quạt
  [Xử lý]     PATCH state=resolving  + action="Thay phụ tùng, khởi động lại quạt"
       ↓ DO hồi phục > 5 mg/L trong 3 phút
  [Hồi phục]  PATCH state=recovered  + action="Ao ổn định trở lại"
  ```

---

## 2. Ngưỡng chỉ tiêu theo đề tài

| Chỉ tiêu | Giá trị bình thường | Warning (⚠) | Critical (🚨, mở incident CRITICAL) |
|---|---|---|---|
| Temperature (°C) | 26 – 32 | > 32 hoặc < 26 | — |
| DO (mg/L, oxy hòa tan) | > 5 | < 4 mg/L | < 3 mg/L **HOẶC** drop rate > 0.05 mg/L/phút qua $setWindowFields 300s window |
| pH | 7.5 – 8.5 | < 7.5 hoặc > 8.5 | — |
| Alkalinity (mg_CaCO₃/L) | 120 – 200 | < 120 | — |
| CO₂ (mg/L, derived) | < 10 | > 10 | — |
| Pump Power avg(last_5m) | > 100 W | — | **< 50 W** (quạt hỏng → incident root_cause=pump_failure) |
| TTL (Data Retention) | 7 ngày (expireAfterSeconds = **604800**) | — | — |

---

## 3. Kiến trúc hệ thống 5 Service

```
          ┌─────────────────────────────────────────────────────────────┐
          │                        Docker Compose                       │
          │                                                             │
┌───────────────────────────────┐         ┌────────────────────────────┐
│   🦐 Pond Simulator (30s tick)│ HTTP    │  ⚡ FastAPI API :8000       │
│   - 6 ponds diurnal cycle     ├────────►│  - /ingest/batch           │
│   - Manual alkalinity 4x/day  │  batch  │  - /incidents GET/PATCH    │
│   - Initial 6h backfill       │         │  - /ponds + /pump/fail     │
└──────────────┬────────────────┘         └────┬───────────┬────────────┘
               │  DogStatsD UDP 8125           │ Pymongo   │ Pymongo
               │  metrics pond/device_type     │           │
               ▼                                ▼           ▼
    ┌─────────────────────┐         ┌────────────────────────────────┐
    │ 🐶 Datadog Agent     │         │ 🍃 MongoDB 7 :27017            │
    │ 7.59.0              │◄────────┤  • Database: shrimpwatch        │
    │ - StatsD 8125/udp   │ logs    │  • metrics (Time Series)       │
    │ - APM 8126/tcp      │ traces  │  • ponds (documents)           │
    │ - HTTP Check API    │         │  • incidents + actions (docs)  │
    │ - Port 5000 (GUI opt)│         │  • events / alkalinity_logs   │
    └─────────────────────┘         └───────────────┬────────────────┘
                                                    ▼ Aggregate pipeline
                                          ┌─────────────────────────┐
                                          │ 🛠 Worker (ticker 30s)   │
                                          │ - CO2 derived calc       │
                                          │ - $setWindowFields 300s  │
                                          │   DO drop rate compute   │
                                          │ - Incident state machine │
                                          └─────────────────────────┘
```

| Service | Container image / Port | Role |
|---|---|---|
| `mongodb` | `mongo:7` / **27017** (host) | DB chính. Init script `mongo-init.js` tạo user `shrimp_app` role dbOwner@shrimpwatch. |
| `api` | `test-api` local image / **8000** (host) | FastAPI ingest, CRUD incidents, Swagger /docs, ddtrace auto instrument FastAPI+pymongo. |
| `simulator` | `test-simulator` local image | Gửi batch 6 ponds metrics HTTP + DogStatsD gauges. |
| `worker` | `test-worker` local image | Tính CO2, chạy $setWindowFields aggregation, detect incident, auto-recover. |
| `datadog-agent` | `gcr.io/datadoghq/agent:7.59.0` / 8125 UDP, 8126 TCP, 5000 (opt GUI) | DogStatsD → Datadog Metrics, APM Trace intake, log collection, http_check /healthz. |

---

## 4. Cấu trúc thư mục code

```
shrimpwatch/
├── app/
│   ├── __init__.py
│   ├── main.py                 Entry point uvicorn (ddtrace-run)
│   ├── config.py               Settings (thresholds, TTL, interval, 6 ponds)
│   ├── models.py               Pydantic v2 models + Enums
│   ├── logging_setup.py        python-json-logger + TraceIdFilter (trace_id/span_id vào logs - Yêu cầu #5)
│   ├── metrics.py              DogStatsD gauge wrapper, tags pond+device_type (Yêu cầu #6)
│   ├── db.py                   Pymongo + init_collections() Time Series + TTL
│   ├── api/__init__.py         FastAPI routes /healthz /ingest /ponds /incidents PATCH
│   ├── simulator.py            Diurnal physics + 6 ponds + backfill 6h
│   ├── worker.py               CO2 + $setWindowFields + Incident detection
│   ├── demo_incident.py        Script demo 4 bước open→investigating→resolving→recovered
│   └── datadog_push.py         Script upload dashboard + 2 monitors JSON lên Datadog cloud
├── tests/
│   └── test_pipeline.py        9/9 pytest PASSED (07/10)
├── datadog/
│   ├── dashboards/shrimpwatch_overview.json       11 widgets, 3 group, template vars farm_id/pond/device_type
│   └── monitors/
│       ├── pump_failure_critical.json             Yêu cầu #4: avg(last_5m):pump_power < 50 → CRITICAL Alert
│       └── do_drop_warning.json                   Bonus: DO drop anomaly WARNING
│   └── conf.d/ (http_check.d + python.d cho Agent)
├── scripts/                      (JS files cho mongosh --file pipe an toàn PowerShell)
├── mongo-init.js                 Idempotent tạo user shrimp_app (dbOwner + readAnyDatabase@admin)
├── docker-compose.yml            5 services core
├── docker-compose.override.yml   Mount scripts + Datadog port 5000 GUI opt
├── Dockerfile                    Python 3.11 slim
├── Makefile                      make up/down/build/demo/test/push-dashboards/reset
├── requirements.txt
├── .env.example                  Mẫu các biến môi trường (KHÔNG CHỨA GÍÁ TRỊ THẬT)
├── .gitignore                    Bao gồm .env để không lộ secrets (ĐÃ VERIFY)
├── screenshots_pytest.txt        Output pytest 9/9 PASSED ngày 07/10
└── README.md                     File này
```

---

## 5. Hướng dẫn Cài đặt & Khởi động (Local Docker Compose)

### Yêu cầu Hệ thống
- Docker Desktop (mới nhất) + Docker Compose plugin
- Windows 10/11 với PowerShell 5 (hoặc Linux / macOS tương đương)
- RAM khuyến nghị ≥ 8 GB (5 containers chạy song song)

### Bước 1: Tạo file `.env` (mẫu)
```powershell
Copy-Item .env.example .env
# Bỏ đi MONGODB_URI line ra khỏi .env (để dùng uri hardcoded trong docker-compose.yml)
```
Bạn không cần fill DD_API_KEY / DD_APP_KEY cho đến ngày 10/10 (trong local evidence đủ dùng).

### Bước 2: Build images + start all services
```powershell
# HOẶC dùng Makefile:
# make build
# make up

# (hoặc PowerShell thô)
docker compose build --no-cache
docker compose up -d
Start-Sleep -Seconds 30
docker compose ps
# Kết quả mong muốn: 5 dòng Up, mongodb status healthy
```

### Bước 3: Init MongoDB + Seed 6 ponds
```powershell
docker compose exec api python -m app.init_db
# Mong muốn log: init_collections OK, 6 ponds seeded.
```

### Bước 4: Verify pytest 9/9 PASSED (07/10 đã PASS)
```powershell
docker compose restart api
docker compose exec api pytest -v tests/
# Output cuối cùng: 9 passed, 3 warnings in 1.xx s
```

### Bước 5: Stop lại hệ thống khi không dùng
```powershell
docker compose down
# Reset volume để re-run mongo-init.js (nếu cần):
# docker compose down -v
```

---

## 6. 7 Yêu Cầu Nghiêm Thu (Definition of Done) và Bằng chứng

| # | Yêu cầu | Bằng chứng đã có (07/10) | Khi nào 100% hoàn toàn |
|---|---|---|---|
| **#1** 🟢 MongoDB metrics là **Time Series Collection** có `timeField` / `metaField` / `granularity=seconds` + TTL `expireAfterSeconds=604800` (7 ngày). | Lệnh `listCollections` → timeField=timestamp, metaField=metadata, granularity=seconds, expireAfterSeconds=604800. Thứ Tự thư mục: [mongo-init.js](mongo-init.js) / [app/db.py](app/db.py). | ✅ **100% — 07/10 đã XONG** |
| **#2** 🟢 Aggregation dùng **`$setWindowFields` stage** window 300s tính DO drop rate (mg/L/phút), kết quả lưu trong field `incidents.evidence`. | pytest `test_setwindowfields_do_drop_rate_pipeline` PASSED. Pipeline định nghĩa trong `worker.compute_do_drop_rate_pipeline()`. | ✅ **100% — 07/10 đã XONG** |
| **#3** 🟡 Datadog **ít nhất 1 Dashboard** hiển thị metric thật. | File [datadog/dashboards/shrimpwatch_overview.json](datadog/dashboards/shrimpwatch_overview.json) 11 widgets có; Agent đã nhận 2,363 DogStatsD samples trong 2 phút. | Đến 10/10 fill `DD_API_KEY` → `python -m app.datadog_push` → chụp ảnh Dashboard render dữ liệu thật → 100%. |
| **#4** 🟡 Datadog **ít nhất 1 Monitor** cho Alert thật khi quạt hỏng (avg 5 phút pump_power < 50W → CRITICAL). | File [datadog/monitors/pump_failure_critical.json](datadog/monitors/pump_failure_critical.json) đã có; pytest incident open CRITICAL PASSED. | Đến 10/10 push monitor → chạy `demo_incident` đợi 5 phút → Monitor Alert đỏ → chụp → 100%. |
| **#5** 🟡 (Bonus) Structured JSON logs có field **`trace_id`** từ ddtrace; APM trace span có MongoDB/pymongo span. | `logging_setup.py` TraceIdFilter + `ddtrace-run` wrapper đã cấu hình đúng. `docker compose logs api | findstr trace_id` ra JSON có trace_id thật. APM Agent: 14 traces, 24 spans (FastAPI+pymongo) đã nhận. | Đến 10/10 web Logs view click trace_id → View Trace thấy span pymongo → chụp ảnh correlation → 100%. |
| **#6** 🟡 (Bonus) Đơn nhất **Tags `pond` + `device_type`** trong metrics/logs/traces; có thể jump từ log → trace qua trace_id. | `metrics.py` gauge/increment luôn append tags; dashboard JSON + monitor JSON có template vars đúng tên tags. | Đến 10/10 vào dashboard chọn pond=pond-03 filter 3 pillars → chụp ảnh → 100%. |
| **#7** 🟢 **Video demo 4 bước** end-to-end Incident Lifecycle: detect → điều tra → xử lý → hồi phục. | Script `app/demo_incident.py` viết sẵn, pytest patch_incident PASSED. | ✅ Logic 100% OK — chỉ cần quay video chạy script (07/10) là 100% — không cần chờ 10/10! |

---

## 7. Các Phương Pháp Inspect Dữ liệu Hôm nay (07/10 - Không cần key Datadog)

### 7.1 Inspect MongoDB (4 cách)
| Cách | Lệnh |
|---|---|
| **Cách 1: mongosh (PIPE stdin an toàn)** | Copy JS vào `@' ... '@` rồi pipe — xem hướng dẫn scripts/ |
| **Cách 2: MongoDB Compass (GUI app)** | Tải app, connect URI `mongodb://shrimp_app:shrimp_pass@localhost:27017/shrimpwatch?authSource=shrimpwatch`. Tab Schema cho metrics, Documents cho incidents evidence. |
| **Cách 3: FastAPI Swagger UI** | Mở trình duyệt → **http://localhost:8000/docs** → GET /ponds → Try it out → Execute → thấy 6 ponds. GET /incidents → thấy incidents đang mở. |
| **Cách 4: Browser raw JSON** | Mở **http://localhost:8000/ponds** (array 6 ponds), **http://localhost:8000/incidents** (array incidents). |

### 7.2 Inspect Datadog TODAY (không cần key thật, 2 cách CLI)
| Cách | Lệnh PowerShell | Output chứng minh |
|---|---|---|
| **Cách A: `agent status` CLI (khuyên dùng)** | `docker compose exec -T datadog-agent agent status` | Dogstatsd Metric Samples (>= 2,000), APM Traces Received (>= 10), Spans Received (>= 20), Logs enabled = true, http_check Running [OK]. |
| **Cách B: docker logs API grep trace_id** | `docker compose logs api --tail 150 \| Select-String trace_id` | Các dòng JSON có `"trace_id":"0123456789abcdef..."` 32 ký tự hex → chứng minh Log↔Trace correlation (Yêu cầu #5). |

---

## 8. 🚨 3 VIỆC CẦN LÀM NGÀY 10/10 (Key Trial Datadog Kích Hoạt) — NỘP BÀI TRƯỚC 23:59 10/10

> 📅 **Ngày giờ:** Thứ Sáu, 10 tháng 10 năm 2026, từ 9h sáng (khi BTC gửi email kích hoạt trial Datadog chứa DD_API_KEY / DD_APP_KEY).
> 🎯 **Mục tiêu của ngày:** Đẩy Dashboard + Monitor lên Cloud Datadog → Chạy demo Incident → Monitor Alert Đỏ → Chụp 3 ảnh web bằng chứng → Push GitHub + Add Collaborator BTC → Điền form nộp bài.

---

### 🟢 NHIỆM VỤ 10/10 — Bước 1/5: Fill 3 dòng ENV thật vào `.env` host
**Nhận thông tin từ email BTC trial:**
- `DD_API_KEY` (Org Settings → API Keys, cho Agent gửi data)
- `DD_APP_KEY` (Org Settings → Application Keys, cho script đẩy dashboard/monitor)
- Xác định `DD_SITE` dựa trên URL bạn đăng nhập web Datadog:

| URL đăng nhập web | DD_SITE giá trị đúng |
|---|---|
| app.`datadoghq.com` | `datadoghq.com` |
| app.`datadoghq.eu` | `datadoghq.eu` |
| app.`ap1.datadoghq.com` | `ap1.datadoghq.com` |

**Thực hiện (VS Code mở file `.env`):**
```
DD_API_KEY=<thay bằng giá trị thật từ BTC>
DD_APP_KEY=<thay bằng giá trị thật từ BTC>
DD_SITE=<thay bằng giá trị đúng từ bảng trên>
FARM_ID=farm-001
NUM_PONDS=6
INTERVAL_SECONDS=30
API_URL=http://api:8000
# LƯU Ý: KHÔNG điền MONGODB_URI ở đây — để docker-compose.yml hardcoded uri authSource=shrimpwatch.
```

Sau khi save `.env` → Apply env mới vào containers:
```powershell
# Restart 3 services nhận env DD_*
docker compose restart api datadog-agent
# Chờ 90 giây để Agent handshake Datadog cloud thành công
Start-Sleep -Seconds 90
# Verify agent OK:
docker compose exec -T datadog-agent agent status
# (Output section "Forwarder / API Keys available" phải hiện ✅ Valid API Key, OK forward)
```

---

### 🟢 NHIỆM VỤ 10/10 — Bước 2/5: Push Dashboard + 2 Monitor lên Datadog Cloud
```powershell
docker compose exec api python -m app.datadog_push
```
Output mong muốn:
```
✅ Dashboard 'ShrimpWatch - Giám sát chất lượng nước Ao nuôi tôm thẻ chân trắng' pushed thành công (id=xxx-xxx-xxx)
✅ Monitor CRITICAL '[ShrimpWatch] Pump Failure (avg 5m < 50W)' pushed thành công (id=12345)
✅ Monitor WARNING  '[ShrimpWatch] DO Rate Drop Anomaly' pushed thành công (id=12346)
```

Vào web Datadog verify nhanh:
- **Dashboards → Dashboard List:** mở dashboard "ShrimpWatch...". Bấm **Configure timeframe: Last 15 phút** (phải chờ khoảng 10–15 phút simulator gửi đủ dữ liệu để biểu đồ hình sin hiện rõ ngày/đêm). → Khi biểu đồ rõ ràng → **CHỤP TOÀN MÀN HÌNH** lưu file `assets_proof/07_datadog_dashboard.png` (dùng làm Bằng chứng Yêu cầu #3).
- **Monitors → Monitors (Manage):** tìm 2 monitor đã push (1 CRITICAL đỏ + 1 WARNING vàng) → trạng thái ban đầu là **No Data** hoặc **OK**.

---

### 🟢 NHIỆM VỤ 10/10 — Bước 3/5: Chạy Demo Incident (Inject Quạt Hỏng) để Monitor chuyển Alert ĐỎ
Mở **1 tab Terminal mới** (để chạy demo, tab cũ giữ cho log hiện liên tục):
```powershell
# Xóa incident cũ pond-03 cho sạch:
@' db.getSiblingDB("shrimpwatch").incidents.deleteMany({pond_id:"pond-03"}); printjson({deleted_incidents_pond03: db.runCommand({getLastError:1}).n}); '@ | docker compose exec -T mongodb mongosh -u admin -p admin_pass --quiet

# Chạy demo_incident (mất 90s để inject quạt hỏng + wait worker detect)
docker compose exec -t api python -m app.demo_incident
```

Trong khi chờ 90s demo chạy xong → **CHỜ THÊM 5 PHÚT NỮA** (vì Monitor rule là `avg(last_5m):avg:pump_power.pump{service:shrimpwatch,farm_id:farm-001} < 50`).

Sau ~5 phút → vào web Datadog → **Monitors → Triggers / Triggered Monitors**:
👉 Bạn thấy monitor **[ShrimpWatch] CRITICAL: Pump Failure** hiện trạng thái **ALERT màu đỏ** với đầy đủ tags pond=pond-03, message chứa "Sự cố quạt nước hỏng → oxy giảm nhanh → 4 bước xử lý..." → **CHỤP ẢNH NÀY** lưu `assets_proof/08_datadog_monitor_alert.png` (Bằng chứng Yêu cầu #4).

---

### 🟢 NHIỆM VỤ 10/10 — Bước 4/5: Capture ảnh Log ↔ Trace ↔ Metric Correlation (Yêu cầu #5 #6 Bonus)
Vào web Datadog → menu **Logs** (hoặc Logs Search):
- Tìm log có message: `Incident CRITICAL opened` (hoặc search chuỗi `"incident opened"`).
- Mở chi tiết 1 log record trong kết quả → tìm trường `@trace_id` (hoặc `trace_id`) bên trong JSON Attributes (hoặc tìm link **View Trace** màu xanh inline).
- Click **View Trace** → nhảy sang tab **APM → Traces**, thấy Waterfall có 2 span con:
  - `fastapi.request` span (tên route POST /ingest/batch)
  - `mongodb.query` span (pymongo span lọc metric pond-03 trong $setWindowFields)
- Trên cùng Dashboard chọn **template variable pond = pond-03, device_type=worker** → confirm Metrics, Logs cùng filter value.

→ **CHỤP ẢNH NÀY (toàn bộ màn hình log + trace waterflow + tags panel)** lưu `assets_proof/09_datadog_correlation_log_trace_metric.png` (Bằng chứng #5 #6).

---

### 🟢 NHIỆM VỤ 10/10 — Bước 5/5: Nộp Bài BTC trước 23:59
Kiểm tra lại toàn bộ **Bộ Bằng Chứng Nộp Bài** (phải có đủ 10 items):

| # | File trong `assets_proof/` (hoặc Google Drive riêng) | Dùng cho yêu cầu # |
|---|---|---|
| 1 | `01_mongo_timeseries_ttl.png` | #1 (TimeSeries + TTL) |
| 2 | `02_pytest_9_xanh.png` | Chung |
| 3 | `03_agent_status_metrics_logs_apm.png` | Setup Datadog tổng quan |
| 4 | `04_swagger_ui_incidents.png` | #2 #7 |
| 5 | `05_docker_logs_api_trace_id.png` | #5 |
| 6 | `06_mongodb_document_incident.png` | #2 #7 |
| 7 | `07_datadog_dashboard.png` (10/10 mới có) | #3 |
| 8 | `08_datadog_monitor_alert.png` (10/10 mới có) | #4 |
| 9 | `09_datadog_correlation_log_trace_metric.png` (10/10 mới có) | #5 #6 Bonus |
| 10 | `ShrimpWatch_Full_Incident_Lifecycle_YeuCau7.mp4` (Video 2-3 phút quay từ 07/10) | #7 (Luồng sự cố end-to-end) |

Sau khi đủ 10 items:
1. **Push ảnh/video mới lên GitHub repo private:**
   ```powershell
   cd d:\JOB\JOB\test
   git add README.md assets_proof/
   git commit -m "📦 Add full assets_proof (9 images + 1 video) + README detailed"
   git push origin main
   ```
2. **Add tài khoản BTC làm Collaborator repo:**
   → Vào web: `https://github.com/HoNgocDung1503/shrimpwatch/settings/access`
   → **Add people** → nhập chính xác account GitHub BTC (BTC sẽ public account này trong email 10/10) → chọn role **Read** (hoặc Write nếu BTC yêu cầu).
3. **Điền form nộp bài BTC trước 23:59 10/10:**
   → Truy cập: `https://mini-hackathon-sep-2026.mugvn.com/`
   → Tab **Submit bài** hoặc **Team Registration** (nếu chưa đăng ký team → đăng ký team BƯỚC ĐẦU TIÊN, trước khi submit).
   → Điền:
     - Tên team + Tên thành viên + MSSV (nếu có)
     - Link GitHub repo private: `https://github.com/HoNgocDung1503/shrimpwatch`
     - Link Google Drive chứa Folder `assets_proof/` (9 ảnh + 1 video) **hoặc** 9 ảnh đính kèm trực tiếp form
     - Link Video Demo Incident Lifecycle #7 (nếu lớn > 25MB phải Drive, không đính kèm form)
     - MongoDB Atlas connection string (nếu dùng Atlas thay cho local Docker — không bắt buộc)
   → Nhấn **Submit bài** ✅ → nhận email xác nhận submit.

→ **XONG 100% TOÀN BỘ DỰ ÁN 🏆🦐🚀**

---

## 9. Tham khảo & Công nghệ

| Danh mục | Stack ĐÃ DÙNG (chính xác theo đề tài) |
|---|---|
| Ngôn ngữ / Runtime | **Python 3.11**, Pydantic v2 |
| Web Framework | **FastAPI + uvicorn**, httpx (batch HTTP) |
| Database | **MongoDB 7 Community** (pymongo) — Time Series + `$setWindowFields` + `$dateTrunc` + expireAfterSeconds TTL |
| Observability (3 pillars) | **DogStatsD (Datadog library)** → Metrics, **ddtrace-run** → APM (auto FastAPI+pymongo spans), **python-json-logger + Datadog Agent Logs Intake** → structured Logs (trace_id inject) |
| Deploy | **Docker Compose single-command**, Makefile (make up/demo/test/...) |
| Testing | **pytest + TestClient** (9/9 PASSED ngày 07/10) |
| Monitoring UI (ngoài Datadog web) | FastAPI Swagger /docs, MongoDB Compass (GUI local), mongosh CLI |

---

> 💡 **Lưu ý cuối:** Không bao giờ commit `.env` (đã add vào .gitignore). Không chia sẻ `DD_API_KEY`, `DD_APP_KEY`, `MONGODB_PASSWORD` ra Discord công cộng / GitHub public. Nếu cần trợ giúp hãy mang output lỗi (terminal log) đến BTC / Mentor hỏi trong giờ làm việc 09:00-18:00 ngày 10/10.

**GOOD LUCK & CHIẾN THẮNG HACKATHON! 🏆🦐🚀**
