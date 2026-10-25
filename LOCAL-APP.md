# Dùng TrendRadar bằng giao diện

Trong thư mục dự án, bấm mở `TrendRadar.desktop`. Trên Linux, nếu trình quản lý tệp hỏi, chọn cho phép chạy launcher. Cửa sổ terminal cần được giữ mở để ứng dụng hoạt động.

Cách mở tương đương từ terminal:

```bash
bash start-local-app.sh
```

Trình duyệt mở `http://127.0.0.1:8766`. Nếu cổng đang được dùng, chạy `bash start-local-app.sh --port 8767`.

1. Mở **Theo dõi** để quản lý nguồn tin và chủ đề quan tâm:
   - **Nguồn tin**: Có công tắc tổng cho RSS và bảng tin thịnh hành, danh sách nguồn trực quan để xem/chỉnh sửa tên, địa chỉ, bật/tắt từng nguồn và thêm nguồn RSS mới. Mã định danh của các nguồn hiện có được giữ nguyên.
   - **Chủ đề quan tâm**: Biểu mẫu quy tắc theo dõi phân tích tệp từ khóa thành các khối nhóm và bộ lọc loại trừ chung, hiển thị rõ loại quy tắc (thông thường, bắt buộc `+`, loại trừ `!`, giới hạn số lượng `@`, tên hiển thị `=>`, biểu thức tìm kiếm) và cho phép đổi tên chủ đề, sửa dòng quy tắc hoặc thêm chủ đề mới an toàn.

2. Mở **Cài đặt** để cấu hình toàn bộ hệ thống qua các biểu mẫu trực quan:
   - **Lịch xử lý tin**: Chọn mẫu lịch xử lý và xem mô tả chi tiết cách xử lý tin trong từng khung giờ.
   - **Tùy chọn cho lần lấy tin tiếp theo**: Cho phép phân tích/dịch bằng AI hoặc gửi thông báo cho riêng lượt chạy kế tiếp. Lựa chọn này được đặt lại khi mở lại trang.
   - **Thiết lập ứng dụng và kết nối**: Quản lý trực quan toàn bộ các nhóm cấu hình (ứng dụng chung, báo cáo, chiến lược lọc, hiển thị, thông báo, lưu trữ, mô hình AI, phân tích/dịch AI, cài đặt kỹ thuật). Các thông tin bảo mật và khóa kết nối (API key, mật khẩu, token, webhook) được che dưới dạng trường mật khẩu. Trường thời hạn lưu trữ (`retention_days`) ở mục lưu trữ được khóa ở chế độ chỉ xem để bảo vệ an toàn dữ liệu, ngăn ngừa nguy cơ tự động xóa mất dữ liệu cũ.
   - **Lịch tuần và khung giờ**: Quản lý trực quan cấu hình khung giờ (`periods`), kế hoạch ngày (`day_plans`), ánh xạ lịch tuần theo từng thứ (`week_map`) và thiết lập mặc định ngoài khung giờ (`default`). Cho phép thêm khung giờ mới, thêm kế hoạch ngày và điều chỉnh các liên kết khung giờ trực tiếp trên giao diện.

3. Dùng chung một nút **Lưu thay đổi** ở thanh cố định phía dưới cho cả mục Theo dõi và Cài đặt. Các lựa chọn chưa lưu được giữ chung trên màn hình; chỉnh ở mục này không làm mất nội dung đang nhập ở mục khác. Nếu không kết nối được khi chỉnh cấu hình, dùng **Thử lại thay đổi** hoặc **Giữ lựa chọn cũ** trong thông báo.

4. Bấm **Lấy tin mới**. Nút bị khóa trong lúc chạy và tiến trình hiện phía trên.

5. Xem kết quả trong **Tin mới** hoặc bấm **Mở trang tin riêng**. **Lịch sử** giúp mở lại kết quả các lần trước. Bạn vẫn có thể đọc kết quả cũ trong lúc ứng dụng lấy tin.

   Trong **Lịch sử**, mục **Thùng báo cáo** giữ các báo cáo đã được bỏ vào thùng để có thể khôi phục. Trước khi chuyển một báo cáo, ứng dụng yêu cầu xác nhận chính xác một tệp HTML và hiển thị tên báo cáo, thời điểm cùng đường dẫn tệp. Bản hiện tại `current`/`latest` không thể bỏ vào thùng. Khôi phục đưa tệp về đường dẫn ban đầu; nếu đường dẫn đó đã có tệp mới, thao tác dừng và không ghi đè tệp nào. Đây không phải thao tác xóa vĩnh viễn. Dữ liệu tin, nguồn RSS, cấu hình và các bản sao lưu vẫn được giữ.

Chọn lịch xử lý không tự tạo bộ hẹn giờ lấy tin và chưa có scheduler tự động chạy ngầm trên máy cục bộ. Lịch chỉ quyết định cách xử lý dữ liệu khi một lượt chạy được gọi (ví dụ bấm nút **Lấy tin mới** hoặc chạy lệnh định kỳ riêng). Muốn cập nhật tin tức ngay, hãy bấm nút lấy tin.

Mỗi lần lưu đều giữ bản cũ trong `output/config_backups/`. Không thể lưu trong lúc lấy tin. Nếu tệp bị sửa bên ngoài, cần tải lại trước khi lưu để tránh ghi đè thay đổi đó.

Nếu lỗi ghi xảy ra trong lúc lưu, ứng dụng thử khôi phục các tệp đã ghi về bản cũ. Nếu ổ đĩa vẫn không cho ghi, thông báo sẽ chỉ rõ tệp cần khôi phục và nơi giữ bản sao. Khi máy chủ đã lưu nhưng phản hồi bị mất, giao diện đối chiếu lại sau khi kết nối phục hồi; những chỉnh sửa mới trên màn hình vẫn được giữ nguyên.

Trước khi lấy tin, các báo cáo hiện có được sao lưu vào `output/report_backups/`. Lượt chạy từ giao diện không tự xóa dữ liệu hết hạn. Bấm biểu tượng lần nữa sẽ mở ứng dụng đang chạy.

AI và gửi thông báo mặc định không được phép trong lượt chạy từ giao diện. Nếu muốn dùng, nhập thông tin kết nối trong các nhóm thiết lập trực quan tương ứng, rồi chọn tùy chọn cho phép trong **Cài đặt → Tùy chọn cho lần lấy tin tiếp theo**. Nhập khóa kết nối không tự gọi AI hoặc gửi thông báo khi lưu; việc gọi AI chỉ diễn ra khi bạn bấm lấy tin và đã tích chọn cho phép. Tùy chọn cho phép được đặt lại khi mở trang mới.

Ứng dụng chỉ nghe trên máy cục bộ. Không chia sẻ cổng qua proxy hoặc mạng công cộng: trang cấu hình dành cho người đang sử dụng máy và có thể chứa thông tin bí mật của họ. Ứng dụng không lưu hay hiển thị log thô của bộ thu thập.

Giao diện cơ bản dùng thư viện đọc YAML được lưu sẵn trong `local_ui/vendor/`, không cần tải thư viện từ mạng ngoài khi mở. Việc lấy tin từ nguồn trực tuyến vẫn cần Internet. Nguồn tin và quy tắc lọc được giữ theo cấu hình của bạn; việc đổi giao diện không tự chuyển sang nguồn thể thao.

Các biểu mẫu dùng nhãn tiếng Việt. Chỉ mở nhóm cần chỉnh để tránh phải xem nhiều lựa chọn cùng lúc.

## Xóa mục và chọn bộ theo dõi gợi ý

Ở **Nguồn tin**, mở nguồn cần chỉnh; ở **Theo dõi**, mở nhóm từ khóa để thấy nút **Xóa**. Bạn có thể xóa riêng một quy tắc hoặc cả nhóm. Hộp xác nhận nêu rõ mục bị ảnh hưởng. Thao tác chỉ sửa bản nháp; bấm **Lưu thay đổi** mới ghi xuống tệp, với bản cũ được giữ trong `output/config_backups/`. Tin tức và báo cáo đã thu thập vẫn được giữ.

### Thư viện nguồn báo

Thư viện nguồn hiện có tòa soạn từ Việt Nam, Mỹ, Anh, Nhật Bản và Hàn Quốc, mỗi nước 10 tòa soạn. Trong **Nguồn tin**, lọc theo quốc gia của nguồn hoặc lĩnh vực tin, hay tìm theo tên báo. Chỉ RSS đã xác minh mới có nút thêm; nguồn chưa xác minh vẫn có thể mở trang báo gốc để đọc. Thêm nguồn chỉ đưa lựa chọn vào bản nháp: bấm **Lưu thay đổi** để áp dụng. Thư viện không tự bật tất cả nguồn. Quốc gia của tòa soạn cho biết nguồn báo đặt ở đâu, không quyết định sự kiện thuộc phạm vi Việt Nam hay Quốc tế.

Danh sách và bằng chứng kiểm tra ngày 07/10/2026 nằm trong [SOURCES.md](SOURCES.md): 50 tòa soạn, 10 mỗi nước; 34 tòa soạn có 96 kênh RSS đã xác minh. 16 tòa soạn còn lại chỉ có liên kết mở trang báo và ghi chú lý do chưa thể thêm tự động. Danh mục giao diện đọc từ [local_ui/source-catalog.json](local_ui/source-catalog.json); tình trạng RSS có thể thay đổi sau lượt kiểm tra.

Ở **Cài đặt → Lịch tuần và khung giờ**, có thể xóa liên kết khung giờ khỏi kế hoạch ngày. Muốn xóa hẳn khung giờ, trước tiên bỏ các liên kết đang dùng nó. Muốn xóa kế hoạch ngày, trước tiên chọn kế hoạch khác cho những ngày liên quan trong lịch tuần.

Các bộ gợi ý **Công nghệ, Robotics, Bóng đá, Thể thao, Bóng rổ, AI** cung cấp từ khóa tiếng Việt và tiếng Anh để bắt đầu theo dõi. Xem từ khóa rồi chọn **Thêm bộ theo dõi**; danh sách cũ được giữ, nhóm trùng tên không được thêm lần nữa. Bạn có thể chỉnh lại từ khóa trước khi lưu. Các bộ này lọc tiêu đề từ nguồn đang bật; chúng không tự thêm nguồn, thay phạm vi Việt Nam/Quốc tế hoặc bật AI.

## Phiên bản cấu hình

Thanh **Phiên bản cấu hình** trong **Theo dõi** giữ toàn bộ ba tệp thiết lập, từ khóa và lịch chạy. Chọn một bản rồi bấm **Mở để chỉnh** để đưa nội dung vào bản nháp; bấm **Lưu thay đổi** mới áp dụng. Nếu đang chỉnh dở, giao diện yêu cầu xác nhận trước khi thay bản nháp.

Nhập tên và bấm **Lưu thành phiên bản mới** để giữ một bộ riêng, ví dụ “Bóng đá Việt Nam v2”. Các phiên bản cũ không bị ghi đè. Các lần lưu thông thường cũng giữ phiên bản trước và sau thay đổi. Bản **Cấu hình cũ — đầy đủ** giữ bộ từ khóa trước khi bỏ nhóm tiếng Trung; bản **Việt / Anh — v1** dùng nhóm Việt/Anh. Việc bỏ từ khóa tiếng Trung không tự lọc ngôn ngữ của bài báo hoặc thay nguồn tin.

Các bản nằm trong `output/config_versions/`, có quyền truy cập riêng và được loại khỏi Git vì có thể chứa khóa kết nối. Không chia sẻ thư mục này công khai.


## Không gian đọc tin mới

Menu bên trái gồm **Tin mới**, **Theo dõi**, **Nguồn tin**, **Lịch sử** và **Cài đặt**. Nút **Giao diện nhẹ nhàng / Giao diện cá tính** đổi sắc thái và lưu lựa chọn trên trình duyệt.

**Tin mới** đọc tiêu đề trực tiếp từ báo cáo đã lưu. Tìm theo tiêu đề, nguồn hoặc nhóm chủ đề; bấm một thẻ để xem nguồn, thời gian có sẵn và liên kết **Đọc bài gốc**. Thẻ tin không tự tạo bản tóm tắt hay dữ kiện từ tiêu đề. **Xem báo cáo gốc** giữ cách đọc báo cáo đầy đủ, gồm các phần phân tích đã có. Nếu định dạng báo cáo chưa đọc được, ứng dụng chuyển sang báo cáo gốc.

**Nguồn tin** có danh sách đang theo dõi và thư viện theo quốc gia/lĩnh vực. Các thay đổi vẫn là bản nháp cho đến khi bấm **Lưu thay đổi**; chọn nguồn, sửa chủ đề hoặc đổi giao diện không tự lấy tin, gọi AI hay gửi thông báo.


### Ẩn và theo dõi lại nguồn

**Nguồn đang theo dõi** chỉ hiện nguồn đang bật. Bỏ tích sẽ ẩn nguồn khỏi danh sách trong bản nháp; thông tin nguồn vẫn được giữ trong **Nguồn đã tạm dừng**. Mở mục này và bấm **Theo dõi lại**, hoặc chọn lại nguồn trong thư viện, để nguồn xuất hiện trở lại. Chọn lại nguồn đã có chỉ bật chính nguồn đó, giữ tên/mã và các thiết lập riêng, không thêm bản trùng. Bấm **Lưu thay đổi** để áp dụng.
