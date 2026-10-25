# TrendRadar VN

Giao diện tiếng Việt để thu thập, lọc và đọc tin từ RSS cùng các bảng tin thịnh hành. Bản tùy biến này tập trung vào người dùng không chuyên kỹ thuật: chọn nguồn, đặt chủ đề, bấm lấy tin và đọc kết quả trong một màn hình.

> Dự án được phát triển từ [sansan0/TrendRadar](https://github.com/sansan0/TrendRadar) và tiếp tục sử dụng giấy phép GPL-3.0. Phần giao diện tiếng Việt, quản lý cấu hình, thư viện nguồn, lịch sử báo cáo và triển khai Railway là các thay đổi của repository này.

## Điểm nổi bật

- Giao diện tiếng Việt chạy trên trình duyệt, không cần sửa YAML cho các thao tác thông thường.
- Thu thập RSS độc lập, kể cả khi tắt bảng tin thịnh hành.
- Quản lý nguồn đang theo dõi, nguồn tạm dừng và thêm nguồn từ thư viện có kiểm chứng.
- Theo dõi chủ đề bằng từ khóa thường, từ bắt buộc, từ loại trừ, giới hạn số tin, tên hiển thị và biểu thức tìm kiếm.
- Bộ gợi ý cho Công nghệ, Robotics, AI, Bóng đá, Bóng rổ và Thể thao.
- Ba chế độ báo cáo: tin mới, bảng tin hiện tại và tổng hợp trong ngày.
- Tìm kiếm tin theo tiêu đề, nguồn hoặc nhóm chủ đề; luôn giữ liên kết bài gốc.
- Lưu phiên bản cấu hình, sao lưu trước khi ghi và phát hiện thay đổi từ bên ngoài.
- Xem lịch sử báo cáo; đưa báo cáo vào thùng và khôi phục mà không ghi đè tệp mới.
- Hỗ trợ phân tích, lọc và dịch bằng AI khi người dùng chủ động bật cho từng lượt chạy.
- Có cấu hình Docker/Railway với volume để giữ cấu hình và lịch sử.

## Luồng sử dụng

```text
Chọn nguồn và chủ đề
        |
        v
   Lưu thay đổi
        |
        v
    Lấy tin mới
        |
        v
Đọc tin / báo cáo / lịch sử
```

AI và gửi thông báo mặc định bị tắt trong giao diện. Việc nhập API key không tự tạo yêu cầu trả phí; hệ thống chỉ gọi dịch vụ khi người dùng bật tùy chọn cho lượt chạy tiếp theo rồi bấm **Lấy tin mới**.

## Chạy trên máy cá nhân

### Yêu cầu

- Python 3.12 trở lên.
- [uv](https://docs.astral.sh/uv/) để cài môi trường từ `uv.lock`.
- Internet khi lấy tin từ nguồn trực tuyến.

### Cài đặt

```bash
git clone https://github.com/conanWinner/TrendRadar.git
cd TrendRadar
uv sync --locked
```

### Khởi động

```bash
bash start-local-app.sh
```

Mở `http://127.0.0.1:8766`. Nếu cổng đã được dùng:

```bash
bash start-local-app.sh --port 8767
```

Ứng dụng chỉ lắng nghe trên `127.0.0.1`. Giữ cửa sổ terminal mở trong khi sử dụng.

## Sử dụng giao diện

1. Vào **Nguồn tin** để bật, tạm dừng hoặc thêm RSS.
2. Vào **Theo dõi** để tạo nhóm chủ đề và quy tắc lọc.
3. Vào **Cài đặt** để chọn chế độ báo cáo, lịch xử lý, AI, thông báo và lưu trữ.
4. Bấm **Lưu thay đổi**. Bản cũ được giữ trong `output/config_backups/`.
5. Bấm **Lấy tin mới**.
6. Đọc kết quả tại **Tin mới**, **Xem báo cáo gốc** hoặc **Lịch sử**.

Hướng dẫn chi tiết: [LOCAL-APP.md](LOCAL-APP.md).

## Nguồn tin

Thư viện hiện ghi nhận 50 tòa soạn/ấn phẩm thuộc Việt Nam, Mỹ, Anh, Nhật Bản và Hàn Quốc. Tại thời điểm kiểm tra ngày 07/10/2026:

- 34 tòa soạn có RSS đạt điều kiện kiểm tra.
- 96 kênh RSS đã được xác minh.
- 16 tòa soạn chỉ có liên kết đọc vì RSS chưa đủ điều kiện thêm tự động.

Thông tin này có thể thay đổi khi nhà xuất bản đổi endpoint hoặc chính sách truy cập. Bằng chứng, tiêu chí và giới hạn kiểm tra nằm trong [SOURCES.md](SOURCES.md). Dữ liệu giao diện nằm tại `local_ui/source-catalog.json`.

## Cấu hình

Ba tệp chính:

| Tệp | Mục đích |
|---|---|
| `config/config.yaml` | Nguồn, báo cáo, lọc, AI, thông báo và lưu trữ |
| `config/frequency_words.txt` | Nhóm chủ đề và quy tắc từ khóa |
| `config/timeline.yaml` | Khung giờ và chiến lược xử lý |

Các bản tiếng Việt tham khảo nằm tại `config/config.vi.yaml`, `config/frequency_words.vi.txt` và `config/timeline.vi.yaml`.

Không commit API key, token, webhook hoặc mật khẩu. Ưu tiên biến môi trường, ví dụ:

```bash
export AI_API_KEY='your-key'
```

## Chế độ báo cáo

| Chế độ | Hành vi |
|---|---|
| `incremental` | Chỉ tập trung vào tin mới xuất hiện |
| `current` | Hiển thị các tin phù hợp trong dữ liệu hiện tại |
| `daily` | Tổng hợp các tin phù hợp trong ngày |

Lịch trong `timeline.yaml` chọn cách xử lý khi một lượt chạy được gọi. Giao diện cục bộ chưa tự chạy nền theo lịch; muốn cập nhật ngay, bấm **Lấy tin mới** hoặc dùng bộ lập lịch bên ngoài.

## AI và thông báo

TrendRadar kế thừa khả năng:

- Lọc tin bằng từ khóa hoặc mô hình AI.
- Phân tích và dịch nội dung báo cáo.
- Gửi kết quả qua các kênh thông báo được cấu hình.

Trong giao diện VN, AI và thông báo cần hai điều kiện: có cấu hình kết nối hợp lệ và được bật rõ ràng cho lượt chạy tiếp theo. Tùy chọn cấp phép theo lượt được đặt lại khi mở phiên giao diện mới.

AI chủ yếu làm việc với dữ liệu thu thập như tiêu đề, nguồn và thời gian. Không xem nội dung AI tạo ra là dữ kiện đã xác minh. Khi viết hoặc đăng tin, cần mở bài gốc và kiểm tra lại tỷ số, phát ngôn, chấn thương, chuyển nhượng cùng các thông tin quan trọng.

## Railway

Repository có sẵn:

- `docker/Dockerfile.railway`
- `railway.json`
- `railway_app.py`
- `.railwayignore`

Dịch vụ cần gắn volume tại `/data` để giữ cấu hình, dữ liệu và lịch sử qua các lần triển khai. Xem [RAILWAY-DEPLOY.md](RAILWAY-DEPLOY.md).

### Cảnh báo bảo mật

Bản Railway hiện không có màn hình đăng nhập. Người có URL có thể mở giao diện, xem cấu hình được ứng dụng trả về, sửa thiết lập và kích hoạt lấy tin. Không đưa API key, token hoặc webhook thật vào một bản triển khai công khai. Chỉ dùng trong môi trường kiểm soát hoặc bổ sung lớp xác thực trước khi dùng thực tế.

## Kiểm tra

Chạy test Python không yêu cầu máy chủ HTTP:

```bash
python -m unittest \
  tests.test_config_versions \
  tests.test_local_app \
  tests.test_railway_app \
  tests.test_report_history \
  tests.test_rss_only \
  tests.test_rss_source_dates \
  tests.test_setting_preview \
  tests.test_source_catalog
```

Chạy test Node.js:

```bash
for file in tests/*.cjs; do node "$file" || exit 1; done
```

Chạy toàn bộ test Python, gồm kiểm tra API cần mở cổng localhost:

```bash
python -m unittest discover -s tests -p 'test_*.py'
```

## Cấu trúc chính

```text
TrendRadar/
├── config/                 # Cấu hình nguồn, lọc và lịch xử lý
├── local_ui/               # Giao diện tiếng Việt
├── trendradar/             # Bộ thu thập, lọc, AI, báo cáo và thông báo
├── tests/                  # Test Python và Node.js
├── local_app.py            # Máy chủ giao diện cục bộ
├── railway_app.py          # Điểm chạy trên Railway
├── start-local-app.sh      # Lệnh khởi động cục bộ
├── LOCAL-APP.md            # Hướng dẫn giao diện chi tiết
├── SOURCES.md              # Danh mục và bằng chứng nguồn tin
└── RAILWAY-DEPLOY.md       # Hướng dẫn triển khai Railway
```

## Giới hạn hiện tại

- Không phải hệ thống tòa soạn hoàn chỉnh: chưa có quy trình duyệt bài và xuất bản trực tiếp lên WordPress/Facebook.
- Lịch cấu hình không tự tạo tiến trình chạy nền trong ứng dụng cục bộ.
- Chất lượng RSS phụ thuộc nhà xuất bản; nguồn có thể đổi hoặc ngừng hoạt động.
- Thư viện nguồn phân loại quốc gia của tòa soạn, không tự xác định phạm vi địa lý của sự kiện.
- AI không thay thế việc đọc và kiểm chứng bài gốc.
- Bản Railway chưa có xác thực người dùng.

## Nguồn gốc và giấy phép

- Upstream: [sansan0/TrendRadar](https://github.com/sansan0/TrendRadar)
- Bản tùy biến: [conanWinner/TrendRadar](https://github.com/conanWinner/TrendRadar)
- Giấy phép: [GPL-3.0](LICENSE)

Khi tái sử dụng hoặc phân phối bản sửa đổi, hãy giữ thông tin bản quyền, giấy phép và ghi nhận dự án upstream theo GPL-3.0.
