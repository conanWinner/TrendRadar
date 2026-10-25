# Triển khai giao diện TrendRadar lên Railway

## Các tệp đã chuẩn bị

- `docker/Dockerfile.railway`: đóng gói giao diện và thư viện Python. Dịch vụ hiện chọn tệp này bằng biến `RAILWAY_DOCKERFILE_PATH`.
- `railway.json`: cấu hình tham khảo cho Docker và kiểm tra `/health`. Không dựa vào tệp này để xác định cấu hình thực tế trên Railway; đối chiếu trạng thái dịch vụ khi triển khai.
- `railway_app.py`: chạy giao diện trên cổng `PORT`, không yêu cầu mật khẩu theo lựa chọn của người dùng. Mọi người có đường link đều có thể xem, sửa cấu hình và lấy tin.
- `.railwayignore`: loại dữ liệu cục bộ, môi trường Python và các tệp bí mật khỏi gói tải lên.

Giao diện cục bộ vẫn dùng `local_app.py` như trước.

## Cấu hình dịch vụ

1. Tạo dịch vụ `TrendRadar` trong dự án Railway đã chọn.
2. Gắn volume tại `/data`. Ứng dụng từ chối chạy nếu không có volume.
3. Đặt `PORT=8080` và `RAILWAY_DOCKERFILE_PATH=docker/Dockerfile.railway`. Không cần biến đăng nhập hoặc mật khẩu.
4. Tạo tên miền Railway, cổng 8080; Railway tự cung cấp `RAILWAY_PUBLIC_DOMAIN`.
5. Chạy `railway up --service TrendRadar --detach` từ thư mục dự án này.
6. Chờ trạng thái triển khai `SUCCESS`, kiểm tra `/health`, trang chính và API cấu hình mà không gửi thông tin đăng nhập.

`/health` công khai chỉ trả trạng thái ứng dụng. Trang chính cung cấp mã phiên để giao diện gọi API tự động, người dùng không cần nhập mã hay mật khẩu. Kiểm tra địa chỉ trang và nguồn yêu cầu vẫn được giữ.

## Dữ liệu

Cấu hình hiện tại được sao chép vào volume lần đầu, chỉ bổ sung tệp chưa có. Các lần khởi động sau giữ cấu hình đã lưu. Báo cáo và dữ liệu tin mới được lưu dưới `/data/output`.

Lịch sử trên máy cá nhân không được tải lên trong gói mã nguồn. AI và thông báo vẫn yêu cầu bật rõ ràng cho từng lượt chạy trong giao diện. Bản này lấy tin khi bấm nút, chưa bổ sung bộ chạy định kỳ.

Volume và tài nguyên chạy đều chịu hạn mức của gói Railway. Theo dõi dung lượng và mức sử dụng trong bảng điều khiển.

## Trạng thái ngày 2026-10-07

Đã tải mã từ thư mục dự án hiện tại và triển khai thành công:

- Dự án: `4d4964ef-b98b-4a74-ad54-8b15c06160cf` — TrendRadar.
- Dịch vụ: `578a8820-10ba-46c2-ab13-963824baa133` — TrendRadar.
- Bản triển khai không mật khẩu: `8db4dd50-f7a0-44dd-b88e-2132c4045465`, trạng thái `SUCCESS`.
- URL: https://trendradar-production-4b73.up.railway.app
- Volume: `trendradar-volume`, gắn `/data`, dung lượng 500 MB theo gói Free.
- Truy cập không cần đăng nhập. `railway-access.txt` là thông tin cũ, không còn dùng để đăng nhập; tệp được giữ lại và vẫn bị loại khỏi Git cùng gói tải lên Railway.

Đã bỏ hoàn toàn yêu cầu mật khẩu theo yêu cầu của người dùng và làm trống hai biến đăng nhập cũ trên Railway. Kiểm tra trực tiếp qua HTTPS không gửi thông tin đăng nhập: trang chính, `/health`, cấu hình, trạng thái, danh sách báo cáo, JavaScript và CSS trả 200. Yêu cầu POST xem trước thiết lập trả 200 và không ghi cấu hình; yêu cầu từ nguồn trang khác bị chặn với 403. API vẫn dùng mã phiên do trang chính cung cấp tự động. 19 kiểm tra mã đã đạt. Chưa kiểm tra trực quan trong trình duyệt và chưa chạy thu thập tin, AI hoặc gửi thông báo trên cloud.

Ở lần triển khai đầu, đã khởi động lại dịch vụ Railway và xác nhận cấu hình giữ nguyên. Lần cập nhật này dùng tiếp cùng volume, chỉ bổ sung tệp cấu hình chưa có.

Theo yêu cầu rõ ràng của người dùng, Railway đã nhận yêu cầu xóa `bountiful-inspiration` (`77a3d3aa-b08e-4f2e-98f4-69d3728157bb`). Railway đặt thời điểm xóa là `2026-10-09T15:43:19.269Z` (22:43 ngày 09/10 theo giờ Việt Nam). Dự án `day12-agent-lab` được giữ nguyên.

Các mẫu chuyển sang định dạng cấu hình Railway mới được giữ ở `docker/railway-migration-examples/`, chưa áp dụng vào dịch vụ. Chúng cần SDK Railway nếu muốn sử dụng; không tham gia chạy ứng dụng hiện tại.
