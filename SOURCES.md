# Thư viện nguồn tin TrendRadar

Thư viện có **50 tòa soạn/ấn phẩm khác nhau**, mỗi nước 10: Việt Nam, Mỹ, Anh, Nhật Bản và Hàn Quốc. Đây là danh sách tuyển chọn để theo dõi nhiều lĩnh vực, **không phải bảng xếp hạng uy tín**. Một tòa soạn có nhiều chuyên mục vẫn chỉ tính là một nguồn. Nature là nguồn khoa học của Anh; không dùng chuyên mục Sky Sports làm nguồn thứ hai của Sky.

Kiểm tra ngày **07/10/2026**: **34 tòa soạn có RSS đã xác minh**, **16 tòa soạn chưa có RSS đủ điều kiện thêm tự động**, tổng cộng **96 kênh RSS đã xác minh**. Dữ liệu nằm trong [source-catalog.json](local_ui/source-catalog.json).

## Cách sử dụng

Trong Theo dõi, lọc theo quốc gia của báo, lĩnh vực hoặc tên báo. Bấm **Thêm nguồn này** cho kênh muốn theo dõi, rồi dùng nút **Lưu thay đổi** của ứng dụng. Thêm nguồn chỉ thay bản nháp trên màn hình, không tự lấy tin, gọi AI hoặc gửi thông báo. Nguồn mới được thêm có `enabled: true`; thư viện không tự bật mọi nguồn.

Nếu nhóm lấy tin RSS đang tắt, việc thêm không tự bật công tắc tổng. Bật **Lấy tin từ các nguồn báo và trang tin** trong Theo dõi rồi lưu. Nguồn đã có được ghi “đang bật” hoặc “đang tắt”; không thêm trùng địa chỉ. Nguồn chưa xác minh chỉ có liên kết mở trang báo gốc và nút thêm bị khóa.

**Quốc gia chỉ mô tả nguồn báo**, không phải phạm vi sự kiện. Báo Việt Nam có thể đưa tin NBA; báo Mỹ có thể đưa tin thể thao Việt Nam. Metadata `country` và `category` của nguồn không thay cho việc xác định nơi diễn ra sự kiện.

## Ý nghĩa trạng thái và cách kiểm chứng

- `verified`: yêu cầu HTTP đọc trực tiếp từ endpoint chính thức thành công, XML đọc được, có bản tin cùng tiêu đề và liên kết của tòa soạn, đồng thời ngày đăng mới nhất nằm trong khoảng kiểm tra 7 ngày. Cho phép sai khác giờ nguồn tối đa 2 ngày về phía tương lai; ngày gốc vẫn được giữ trong metadata.
- `rss_unavailable`: chưa có RSS đủ điều kiện thêm trong lượt kiểm tra. Có thể do máy chủ chặn truy cập, endpoint lỗi, thiếu ngày/liên kết hoặc nội dung quá cũ. Trạng thái này **không khẳng định báo hoàn toàn không cung cấp RSS**.
- `feeds` chỉ chứa kênh đã xác minh; `feed_checks` giữ các lần thử chưa đạt cùng lý do. Không dùng Google News hoặc dịch vụ tạo RSS thay thế để gắn tên báo.
- Mỗi kênh có `checked_at`, `final_url`, `content_type`, `item_count`, `newest_publish`, `check_note`, chứng cứ trang chính thức và mẫu tiêu đề/liên kết. Khi thông tin chưa xác định, giá trị là `null`.
- Lĩnh vực dựa trên kênh báo xuất bản và bản tin thực tế đã kiểm tra. Kênh tổng hợp không tự biến thành kênh bóng đá/bóng rổ. Một số kênh khoa học kết hợp công nghệ/y học; ghi chú `category_check_note` nêu rõ điều đó.

Phạm vi kiểm tra là RSS/Atom, trang giới thiệu nguồn và trang danh mục RSS. Chưa kiểm chứng việc ứng dụng thu thập đủ tất cả nguồn, khả năng đọc bài trả phí, nội dung đầy đủ từng bài hoặc quyền tái xuất bản. RSS và liên kết có thể thay đổi sau thời điểm này. Giữ tên báo và liên kết bài gốc khi dùng tin; điều kiện sử dụng của từng tòa soạn vẫn áp dụng.

## Nguồn đã kiểm tra

| Quốc gia | Tòa soạn / ấn phẩm | Trạng thái | Kênh đã xác minh | Chứng cứ chính thức |
|---|---|---|---|---|
| Việt Nam | [VnExpress](https://vnexpress.net/) | Có RSS | 5: Kinh tế, Thể thao, Tổng hợp, Công nghệ, Đời sống | [Trang nguồn](https://vnexpress.net/rss) |
| Việt Nam | [Dân trí](https://dantri.com.vn/) | Có RSS | 6: Tổng hợp, Đời sống, Thể thao, Kinh tế, Công nghệ, Khoa học | [Trang nguồn](https://dantri.com.vn/rss.htm) |
| Việt Nam | [Thanh Niên](https://thanhnien.vn/) | Có RSS | 7: Tổng hợp, Kinh tế, Đời sống, Thể thao, Bóng đá, Công nghệ | [Trang nguồn](https://thanhnien.vn/rss.html) |
| Việt Nam | [Tuổi Trẻ](https://tuoitre.vn/) | Có RSS | 4: Tổng hợp, Kinh tế, Thể thao, Khoa học | [Trang nguồn](https://tuoitre.vn/rss.htm) |
| Việt Nam | [VietNamNet](https://vietnamnet.vn/) | Chưa thêm tự động | 0: — | [Trang nguồn](https://vietnamnet.vn/rss.html) |
| Việt Nam | [VTC News](https://vtcnews.vn/) | Có RSS | 3: Kinh tế, Tổng hợp, Công nghệ | [Trang nguồn](https://vtcnews.vn/main-rss.html) |
| Việt Nam | [Nhân Dân](https://nhandan.vn/) | Có RSS | 3: Tổng hợp, Kinh tế, Thể thao | [Trang nguồn](https://nhandan.vn/rss.html) |
| Việt Nam | [Tiền Phong](https://tienphong.vn/) | Có RSS | 2: Tổng hợp, Thể thao | [Trang nguồn](https://tienphong.vn/rss.html) |
| Việt Nam | [Pháp Luật TP.HCM](https://plo.vn/) | Chưa thêm tự động | 0: — | [Trang nguồn](https://plo.vn/rss.html) |
| Việt Nam | [VietnamPlus](https://www.vietnamplus.vn/) | Có RSS | 6: Tổng hợp, Kinh tế, Đời sống, Thể thao, Bóng đá, Khoa học | [Trang nguồn](https://www.vietnamplus.vn/rss.html) |
| Mỹ | [The New York Times](https://www.nytimes.com/) | Có RSS | 4: Tổng hợp, Kinh tế, Công nghệ, Khoa học | [Trang nguồn](https://www.nytimes.com/services/xml/rss/index.html) |
| Mỹ | [The Washington Post](https://www.washingtonpost.com/) | Có RSS | 2: Thể thao, Kinh tế | [Trang nguồn](https://feeds.washingtonpost.com/rss/sports) |
| Mỹ | [The Wall Street Journal](https://www.wsj.com/) | Có RSS | 1: Tổng hợp | [Trang nguồn](https://feeds.content.dowjones.io/public/rss/RSSWorldNews) |
| Mỹ | [NPR](https://www.npr.org/) | Có RSS | 3: Tổng hợp, Kinh tế, Khoa học | [Trang nguồn](https://feeds.npr.org/1001/rss.xml) |
| Mỹ | [CNN](https://www.cnn.com/) | Chưa thêm tự động | 0: — | [Trang nguồn](https://www.cnn.com/services/rss/) |
| Mỹ | [Associated Press](https://apnews.com/) | Chưa thêm tự động | 0: — | [Trang nguồn](https://apnews.com/) |
| Mỹ | [ESPN](https://www.espn.com/) | Có RSS | 3: Tổng hợp, Bóng rổ, Bóng đá | [Trang nguồn](https://www.espn.com/espn/news/story?page=rssinfo) |
| Mỹ | [CBS News](https://www.cbsnews.com/) | Có RSS | 2: Tổng hợp, Khoa học | [Trang nguồn](https://www.cbsnews.com/rss/) |
| Mỹ | [ABC News](https://abcnews.com/) | Có RSS | 1: Tổng hợp | [Trang nguồn](https://abcnews.go.com/Site/page/rss-feeds-3520115) |
| Mỹ | [USA Today](https://www.usatoday.com/) | Chưa thêm tự động | 0: — | [Trang nguồn](https://www.usatoday.com/) |
| Anh | [BBC](https://www.bbc.com/) | Có RSS | 4: Tổng hợp, Bóng đá, Công nghệ, Khoa học | [Trang nguồn](https://feeds.bbci.co.uk/news/rss.xml) |
| Anh | [The Guardian](https://www.theguardian.com/) | Có RSS | 4: Tổng hợp, Bóng đá, Bóng rổ, Công nghệ | [Trang nguồn](https://www.theguardian.com/help/feeds) |
| Anh | [The Independent](https://www.independent.co.uk/) | Có RSS | 2: Tổng hợp, Thể thao | [Trang nguồn](https://www.independent.co.uk/service/rss) |
| Anh | [Sky News](https://news.sky.com/) | Có RSS | 3: Kinh tế, Công nghệ, Tổng hợp | [Trang nguồn](https://news.sky.com/info/rss) |
| Anh | [The Telegraph](https://www.telegraph.co.uk/) | Chưa thêm tự động | 0: — | [Trang nguồn](https://www.telegraph.co.uk/rss-feeds/) |
| Anh | [Financial Times](https://www.ft.com/) | Có RSS | 1: Kinh tế | [Trang nguồn](https://www.ft.com/rss/home) |
| Anh | [The Economist](https://www.economist.com/) | Có RSS | 1: Tổng hợp | [Trang nguồn](https://www.economist.com/the-world-this-week/rss.xml) |
| Anh | [Reuters](https://www.reuters.com/) | Chưa thêm tự động | 0: — | [Trang nguồn](https://www.reuters.com/) |
| Anh | [Nature](https://www.nature.com/) | Có RSS | 1: Khoa học | [Trang nguồn](https://www.nature.com/nature/articles?type=news) |
| Anh | [The Times](https://www.thetimes.com/) | Chưa thêm tự động | 0: — | [Trang nguồn](https://www.thetimes.com/) |
| Nhật Bản | [NHK](https://www.nhk.or.jp/) | Chưa thêm tự động | 0: — | [Trang nguồn](https://www3.nhk.or.jp/rss/news/cat0.xml) |
| Nhật Bản | [Asahi Shimbun](https://www.asahi.com/) | Có RSS | 4: Tổng hợp, Thể thao, Kinh tế, Khoa học | [Trang nguồn](https://www.asahi.com/information/service/rss.html) |
| Nhật Bản | [Mainichi Shimbun](https://mainichi.jp/) | Có RSS | 2: Tổng hợp, Thể thao | [Trang nguồn](https://mainichi.jp/rss/) |
| Nhật Bản | [Yomiuri Shimbun](https://www.yomiuri.co.jp/) | Chưa thêm tự động | 0: — | [Trang nguồn](https://www.yomiuri.co.jp/) |
| Nhật Bản | [Nikkei](https://www.nikkei.com/) | Chưa thêm tự động | 0: — | [Trang nguồn](https://www.nikkei.com/) |
| Nhật Bản | [Kyodo News](https://english.kyodonews.net/) | Có RSS | 1: Tổng hợp | [Trang nguồn](https://english.kyodonews.net/) |
| Nhật Bản | [The Japan Times](https://www.japantimes.co.jp/) | Có RSS | 1: Tổng hợp | [Trang nguồn](https://www.japantimes.co.jp/feed/) |
| Nhật Bản | [Japan Today](https://japantoday.com/) | Chưa thêm tự động | 0: — | [Trang nguồn](https://japantoday.com/) |
| Nhật Bản | [Sankei Shimbun](https://www.sankei.com/) | Chưa thêm tự động | 0: — | [Trang nguồn](https://www.sankei.com/) |
| Nhật Bản | [Jiji Press](https://www.jiji.com/) | Có RSS | 1: Tổng hợp | [Trang nguồn](https://www.jiji.com/rss/ranking.rdf) |
| Hàn Quốc | [Yonhap News Agency](https://en.yna.co.kr/) | Có RSS | 1: Tổng hợp | [Trang nguồn](https://en.yna.co.kr/RSS/news.xml) |
| Hàn Quốc | [KBS](https://world.kbs.co.kr/) | Có RSS | 4: Tổng hợp, Kinh tế, Khoa học, Thể thao | [Trang nguồn](https://world.kbs.co.kr/service/about_rss.htm?lang=e) |
| Hàn Quốc | [The Korea Herald](https://www.koreaherald.com/) | Có RSS | 4: Tổng hợp, Kinh tế, Đời sống, Thể thao | [Trang nguồn](https://www.koreaherald.com/rss) |
| Hàn Quốc | [The Korea Times](https://www.koreatimes.co.kr/) | Có RSS | 3: Tổng hợp, Thể thao, Kinh tế | [Trang nguồn](https://www.koreatimes.co.kr/rss) |
| Hàn Quốc | [The Hankyoreh](https://www.hani.co.kr/) | Chưa thêm tự động | 0: — | [Trang nguồn](https://www.hani.co.kr/arti/RSS) |
| Hàn Quốc | [Chosun Ilbo](https://www.chosun.com/) | Có RSS | 2: Tổng hợp, Thể thao | [Trang nguồn](https://rssplus.chosun.com/) |
| Hàn Quốc | [JoongAng Ilbo](https://www.joongang.co.kr/) | Chưa thêm tự động | 0: — | [Trang nguồn](https://koreajoongangdaily.joins.com/RSS) |
| Hàn Quốc | [Dong-A Ilbo](https://www.donga.com/) | Có RSS | 4: Tổng hợp, Kinh tế, Khoa học, Thể thao | [Trang nguồn](https://www.donga.com/) |
| Hàn Quốc | [SBS News](https://news.sbs.co.kr/) | Có RSS | 1: Tổng hợp | [Trang nguồn](https://news.sbs.co.kr/news/rss.do) |
| Hàn Quốc | [MBC News](https://imnews.imbc.com/) | Chưa thêm tự động | 0: — | [Trang nguồn](https://imnews.imbc.com/rss/) |

## Các giới hạn cụ thể

- **VietNamNet**: HTTP 404; chưa xác minh được RSS công khai.
- **Pháp Luật TP.HCM**: Trang RSS chuyển hướng sang Tuổi Trẻ. Không lấy feed của tòa soạn khác để gắn tên Pháp Luật TP.HCM.
- **CNN**: Kết nối tới máy chủ RSS bị ngắt trong lượt kiểm tra; chưa xác minh được nguồn công khai.
- **Associated Press**: Trang chính thức trả HTTP 403 trong lượt kiểm tra; chưa xác minh được RSS công khai.
- **USA Today**: Trang chính thức trả HTTP 402; chưa xác minh được RSS công khai.
- **The Telegraph**: HTTP 402; chưa xác minh được RSS công khai.
- **Reuters**: Trang chính thức trả HTTP 401; chưa xác minh được RSS công khai.
- **The Times**: Chưa tìm được RSS công khai đã kiểm chứng trong lượt khảo sát trang chính thức.
- **NHK**: Có XML, nhưng ngày mới nhất không phù hợp kiểm tra cập nhật (59.98 ngày).
- **Yomiuri Shimbun**: HTTP 404; chưa xác minh được RSS công khai.
- **Nikkei**: HTTP 404; chưa xác minh được RSS công khai.
- **Japan Today**: HTTP 403; chưa xác minh được RSS công khai.
- **Sankei Shimbun**: RSS có bản tin mới nhưng liên kết bắt đầu bằng null/article, không mở được bài gốc; chưa cho thêm.
- **The Hankyoreh**: Có XML và bản tin, nhưng chưa xác định được thời gian đăng; không gắn nhãn đã xác minh.
- **JoongAng Ilbo**: Chưa xác minh được RSS công khai; endpoint được kiểm tra trả HTTP 404.
- **MBC News**: Không có RSS/Atom chứa bản tin hợp lệ (HTML, dữ liệu trống hoặc lỗi XML).

- **VTC News**: kênh thể thao trả XML nhưng tin mới nhất đã cũ khoảng 1.225 ngày; không đưa kênh đó vào nút thêm. Các kênh khác được kiểm riêng.
- **The New York Times**: kênh Soccer và ProBasketball còn XML nhưng tin mới nhất cũ khoảng 50 và 32 ngày. Thư viện giữ các kênh tổng hợp, kinh tế, công nghệ, khoa học đã đạt.
- **Tuổi Trẻ**: RSS có ngày dạng `M/D/YYYY h:mm:ss AM/PM` không chuẩn ngày RSS. Trình đọc đã hỗ trợ riêng định dạng này cho `tuoitre.vn` và `www.tuoitre.vn`, kể cả khoảng trắng hẹp dạng ký tự hoặc chuỗi `\u202f`, theo giờ Việt Nam. Kiểm tra bằng XML đã lưu: cả 4 kênh đọc được ngày đăng; không áp dụng cách suy diễn này cho báo khác.
- **Nature**: kênh gồm tin, bình luận và nội dung nghiên cứu; “đã xác minh RSS” không đồng nghĩa từng phát hiện khoa học đã được thẩm định.

## Kiểm tra mã và bằng chứng

Kiểm tra cấu trúc catalog và component bằng dữ liệu cục bộ, không gọi mạng:

```bash
python -m unittest discover -s tests -p test_source_catalog.py -v
```

Bằng chứng HTTP/XML của lượt khảo sát được giữ trên máy tại `/tmp/trendradar-source-research/`: `discovery.json`, `probes-final-with-nature.json`, các trang RSS chính thức và XML đã tải. Đây là đường dẫn bằng chứng cục bộ, không phải tài nguyên cần thiết để chạy ứng dụng. JSON thư viện giữ metadata cần thiết để xem lại trạng thái ngay cả khi không có thư mục tạm.

Component [source-catalog.js](local_ui/source-catalog.js) nạp JSON cục bộ bằng `SourceCatalog.load()`. Tích hợp qua `SourceCatalog.render(container, configText, onChange, locked)`. Khi thêm, gọi `onChange("config", ["rss", "feeds"], feed, "append")`; thao tác sửa bản nháp dùng cùng cơ chế giữ bình luận và các trường chưa biết của ứng dụng.
