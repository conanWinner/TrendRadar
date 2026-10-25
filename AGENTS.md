# Hướng dẫn làm việc với TrendRadar

## 1. An toàn dữ liệu — bắt buộc

Các quy tắc này áp dụng cho mọi công cụ, tiến trình, tác nhân và thiết bị lưu trữ được sử dụng trong dự án.

- Không xoá tệp, thư mục, cơ sở dữ liệu, volume, phân vùng, bản sao lưu, lịch sử, nhánh Git, worktree hoặc dữ liệu chưa được theo dõi khi chưa có sự cho phép rõ ràng của người dùng trong cuộc trò chuyện hiện tại.
- Không suy diễn quyền xoá từ các yêu cầu như “dọn dẹp”, “làm lại”, “sửa lỗi”, “đồng bộ”, “khôi phục” hoặc “cài đặt lại”.
- Trước thao tác có thể xoá hoặc làm mất dữ liệu, xác định chính xác mục tiêu, mô tả dữ liệu bị ảnh hưởng và hỏi xác nhận. Chỉ thực hiện trong phạm vi đã được xác nhận.
- Nếu không chắc thao tác có thể xoá, ghi đè hoặc làm mất dữ liệu hay không, dừng lại và hỏi người dùng; không tự thử.
- Ưu tiên thao tác chỉ đọc và phương án có thể hoàn tác. Không dùng `rm -rf`, `git clean -fd`, `shred`, `wipefs` hoặc công cụ tương đương khi chưa có sự cho phép cụ thể.
- Tuyệt đối không format, reformat, wipe, khởi tạo lại thiết bị, chia lại phân vùng, xoá bảng phân vùng, tạo lại hệ thống tệp, secure erase hoặc factory reset thiết bị lưu trữ.
- Không chạy hoặc hướng dẫn tự động chạy `mkfs`, `fdisk`, `parted`, `diskpart clean`, `format`, `dd` ghi lên thiết bị khối hay API/công cụ tương đương có tác dụng phá huỷ thiết bị lưu trữ.
- Nếu công việc có vẻ cần thao tác bị cấm, dừng lại, giải thích quy tắc và đề xuất phương án không phá huỷ dữ liệu.
- Không uỷ quyền cho script, container, máy ảo, tác nhân, công cụ GUI, công cụ từ xa hoặc bên thứ ba để né tránh các quy tắc này.
- Không sửa, vô hiệu hoá hoặc bỏ qua quy tắc an toàn trừ khi người dùng yêu cầu rõ ràng thay đổi chính tệp quy tắc đó.

## 2. Mục tiêu sản phẩm

Điều chỉnh TrendRadar để hỗ trợ người làm nội dung tìm kiếm, chọn lọc và chuẩn bị nội dung tin tức thể thao, trước mắt là bóng đá và bóng rổ.

Yêu cầu đã thống nhất:

- Người dùng có thể tùy chỉnh phạm vi tin: Việt Nam, Quốc tế hoặc cả hai.
- Phân biệt phạm vi sự kiện với quốc gia/ngôn ngữ của nguồn báo. Báo Việt Nam có thể đưa tin quốc tế; báo quốc tế có thể đưa tin Việt Nam.
- Tận dụng khả năng thu thập RSS, lọc tin, phân tích, dịch và báo cáo hiện có khi phù hợp.

Các hướng đề xuất, cần làm rõ phạm vi trước khi triển khai:

- Chọn môn thể thao, giải đấu, đội và vận động viên muốn theo dõi.
- Bật/tắt nguồn tin và thêm nguồn RSS riêng qua giao diện.
- Lưu bộ theo dõi, ví dụ “Bóng đá Việt Nam”, “Bóng đá quốc tế”, “NBA”.
- Tóm tắt tiếng Việt, gom bài cùng sự kiện, gợi ý góc khai thác và quản lý tin đã chọn/đã đăng.

Tài liệu này ghi nhận định hướng; không tự động cho phép triển khai mọi tính năng đề xuất.

## 3. Nguyên tắc nội dung

- Giữ liên kết bài gốc, tên nguồn và thời gian xuất bản/cập nhật khi có.
- Phân biệt dữ kiện đã xác nhận, tin đồn và nhận định do AI đề xuất.
- Không tự bổ sung tỷ số, thống kê, phát ngôn, thời gian chấn thương hoặc thông tin chuyển nhượng thiếu nguồn.
- Không coi tiêu đề là đủ bằng chứng để viết nội dung chi tiết. Khi cần, đọc bài gốc và kiểm tra nguồn trước khi tạo bản nháp.
- Nếu thiếu dữ liệu hoặc không xác định được phạm vi Việt Nam/Quốc tế, thể hiện rõ trạng thái chưa xác định.

## 4. Quy trình làm việc

- Trao đổi bằng tiếng Việt rõ ràng, ngắn gọn; giải thích thuật ngữ khi cần.
- Với yêu cầu góp ý hoặc định hướng, chỉ khảo sát và đề xuất; chờ yêu cầu triển khai trước khi sửa mã.
- Trước khi chỉnh sửa, đọc hướng dẫn áp dụng và kiểm tra `git status` để nhận diện thay đổi có sẵn.
- Giữ nguyên thay đổi của người dùng; không tự hoàn tác hoặc ghi đè phần việc có sẵn.
- Ưu tiên thay đổi nhỏ, tận dụng kiến trúc hiện tại và giữ tương thích cấu hình khi khả thi.
- Không hiển thị hoặc đưa khoá API, mật khẩu và thông tin bí mật vào mã nguồn, tài liệu hay log.
- Không tự gửi tin, đăng nội dung hoặc thực hiện yêu cầu AI có trả phí khi chưa được người dùng cho phép trong phạm vi công việc.
- Chạy kiểm tra phù hợp với thay đổi. Phân biệt kiểm tra mã nguồn, kiểm tra với dữ liệu giả và xác minh nguồn/runtime thực tế.
- Khi báo cáo kết quả, nêu rõ đã thay đổi gì, đã kiểm tra gì và phần nào còn chưa xác minh.
- Không tự commit, push, merge hoặc triển khai khi chưa được yêu cầu.
