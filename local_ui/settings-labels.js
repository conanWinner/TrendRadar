/* ═══════════════════════════════════════════════════════════════
 * Nhãn tiếng Việt, mô tả và lựa chọn cho biểu mẫu cấu hình TrendRadar
 * Dùng cho generic form hiển thị và chỉnh sửa config.yaml & timeline.yaml
 * ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SettingsLabels = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────
   * 1. sections: Nhóm cấu hình cấp cao nhất (top-level config keys)
   * ───────────────────────────────────────────────────────────── */
  var sections = {
    app: 'Cài đặt chung',
    schedule: 'Lịch xử lý theo khung giờ',
    platforms: 'Nguồn bảng tin thịnh hành',
    rss: 'Nguồn tin RSS',
    report: 'Báo cáo & Tổng hợp tin',
    filter: 'Chiến lược lọc tin',
    ai_filter: 'Lọc thông minh bằng AI',
    display: 'Khu vực hiển thị',
    notification: 'Kênh gửi thông báo',
    storage: 'Lưu trữ & Dữ liệu',
    ai: 'Mô hình AI dùng chung',
    ai_analysis: 'Phân tích tin bằng AI',
    ai_translation: 'Dịch thuật bằng AI',
    advanced: 'Cài đặt kỹ thuật nâng cao',
    presets: 'Các chế độ lịch có sẵn',
    custom: 'Chế độ lịch tự đặt'
  };

  /* ─────────────────────────────────────────────────────────────
   * 2. fields: Ánh xạ tên trường (Ưu tiên dotted path, dự phòng leaf name)
   * ───────────────────────────────────────────────────────────── */
  var fields = {
    /* ─── Leaf Key Fallback (Tất cả khóa lá có mặt trong config & timeline) ─── */
    '1': 'Thứ Hai',
    '2': 'Thứ Ba',
    '3': 'Thứ Tư',
    '4': 'Thứ Năm',
    '5': 'Thứ Sáu',
    '6': 'Thứ Bảy',
    '7': 'Chủ nhật',
    access_key_id: 'ID khóa truy cập (Access Key ID)',
    ai_analysis: 'Khu vực phân tích AI',
    ai_mode: 'Chế độ phân tích AI',
    analyze: 'Phân tích bằng AI',
    api_base: 'Địa chỉ máy chủ API tùy chỉnh (API Base)',
    api_key: 'Khóa API (API Key)',
    api_url: 'Địa chỉ API dữ liệu',
    backend: 'Loại hệ thống lưu trữ',
    bark: 'Thông báo Bark (iOS)',
    batch_interval: 'Khoảng nghỉ giữa các lô (giây)',
    batch_send_interval: 'Khoảng nghỉ giữa các lần gửi (giây)',
    batch_size: 'Kích thước mỗi lô',
    bot_token: 'Token bot Telegram',
    bucket_name: 'Tên bucket (thùng chứa dữ liệu)',
    chat_id: 'ID cuộc trò chuyện Telegram',
    collect: 'Thu thập tin tức',
    configs_version_check_url: 'Địa chỉ kiểm tra phiên bản cấu hình',
    data_dir: 'Thư mục dữ liệu cục bộ',
    day_plans: 'Kế hoạch lịch ngày',
    days: 'Số ngày tải về',
    debug: 'Chế độ gỡ lỗi (Debug)',
    default: 'Mặc định ngoài khung giờ',
    default_proxy: 'Địa chỉ proxy mặc định',
    description: 'Mô tả chi tiết',
    dingtalk: 'Thông báo DingTalk',
    display_mode: 'Tiêu chí nhóm hiển thị',
    enabled: 'Kích hoạt',
    end: 'Giờ kết thúc',
    endpoint_url: 'Địa chỉ điểm cuối (Endpoint URL)',
    expected_domain: 'Tên miền kỳ vọng',
    extract_prompt_file: 'Tệp mẫu gợi ý trích xuất thẻ',
    feishu: 'Thông báo Feishu / Lark',
    feishu_message_separator: 'Dòng phân cách tin nhắn Feishu',
    frequency: 'Trọng số tần suất xuất hiện',
    from: 'Địa chỉ email người gửi',
    hotlist: 'Khu vực bảng tin thịnh hành',
    hotness: 'Trọng số độ nóng / phổ biến',
    html: 'Tạo báo cáo định dạng HTML',
    id: 'Mã định danh',
    include_rank_timeline: 'Bao gồm dòng thời gian thứ hạng',
    include_rss: 'Đưa nội dung RSS vào phân tích',
    include_standalone: 'Đưa khu vực độc lập vào phân tích',
    language: 'Ngôn ngữ đích',
    max_accounts_per_channel: 'Số tài khoản tối đa mỗi kênh',
    max_age_days: 'Số ngày tin tối đa (bộ lọc độ mới)',
    max_items: 'Số lượng tin tối đa',
    max_news_for_analysis: 'Số lượng tin tối đa gửi AI phân tích',
    max_news_per_keyword: 'Số tin tối đa cho mỗi từ khóa',
    max_tokens: 'Số token tối đa tạo ra',
    mcp_version_check_url: 'Địa chỉ kiểm tra phiên bản MCP',
    method: 'Phương thức lọc',
    min_score: 'Điểm số AI tối thiểu để duyệt',
    mode: 'Chế độ hoạt động',
    model: 'Mô hình AI',
    msg_type: 'Loại tin nhắn',
    name: 'Tên hiển thị',
    new_items: 'Khu vực tin nóng mới',
    num_retries: 'Số lần thử lại khi lỗi',
    once: 'Giới hạn thực hiện một lần',
    password: 'Mật khẩu email / Mã ứng dụng',
    payload_template: 'Mẫu định dạng dữ liệu Webhook (JSON)',
    periods: 'Danh sách khung giờ',
    policy: 'Chính sách xử lý trùng khung giờ',
    preset: 'Mẫu lịch xử lý',
    priority_sort_enabled: 'Ưu tiên sắp xếp thẻ sở thích',
    prompt_file: 'Tệp mẫu gợi ý (Prompt file)',
    proxy_url: 'Địa chỉ proxy riêng',
    push: 'Gửi thông báo',
    rank: 'Trọng số thứ hạng',
    rank_threshold: 'Ngưỡng làm nổi bật thứ hạng',
    reclassify_threshold: 'Ngưỡng kích hoạt phân loại lại',
    region: 'Khu vực máy chủ lưu trữ (Region)',
    report_mode: 'Chế độ báo cáo',
    request_interval: 'Khoảng nghỉ giữa các yêu cầu (ms)',
    retention_days: 'Số ngày lưu trữ (0 = vĩnh viễn)',
    rss: 'Khu vực nguồn tin RSS',
    secret_access_key: 'Khóa bí mật truy cập (Secret Access Key)',
    server_url: 'Địa chỉ máy chủ ntfy',
    show_version_update: 'Hiển thị thông báo khi có bản cập nhật',
    slack: 'Thông báo Slack',
    smtp_port: 'Cổng máy chủ SMTP',
    smtp_server: 'Địa chỉ máy chủ SMTP',
    sort_by_position_first: 'Ưu tiên vị trí xuất hiện trước',
    sqlite: 'Lưu trữ cơ sở dữ liệu SQLite',
    standalone: 'Khu vực hiển thị riêng biệt',
    start: 'Giờ bắt đầu',
    temperature: 'Độ sáng tạo của mô hình (Temperature)',
    timeout: 'Thời gian chờ tối đa (giây)',
    timezone: 'Múi giờ hệ thống',
    to: 'Danh sách email nhận tin',
    token: 'Mã xác thực (Token)',
    topic: 'Chủ đề thông báo ntfy',
    txt: 'Xuất bản tin định dạng văn bản (TXT)',
    update_tags_prompt_file: 'Tệp mẫu gợi ý cập nhật thẻ',
    url: 'Đường dẫn liên kết (URL)',
    use_proxy: 'Sử dụng máy chủ proxy',
    version_check_url: 'Địa chỉ kiểm tra phiên bản',
    webhook_url: 'Địa chỉ Webhook',
    week_map: 'Ánh xạ lịch theo các thứ trong tuần',

    /* ─── Dotted Path cụ thể (Ưu tiên ngữ cảnh chính xác của từng nhóm) ─── */
    'app.timezone': 'Múi giờ hệ thống',
    'app.show_version_update': 'Hiển thị thông báo khi có phiên bản mới',
    'schedule.enabled': 'Bật lịch xử lý theo khung giờ',
    'schedule.preset': 'Chế độ lịch xử lý',
    'platforms.enabled': 'Bật thu thập bảng tin thịnh hành',
    'platforms.api_url': 'Địa chỉ API dịch vụ xu hướng',
    'platforms.sources': 'Danh sách nền tảng theo dõi',
    'rss.enabled': 'Bật thu thập nguồn tin RSS',
    'rss.freshness_filter.enabled': 'Bật lọc bài viết theo độ mới',
    'rss.freshness_filter.max_age_days': 'Số ngày tối đa giữ tin (loại tin quá cũ)',
    'rss.feeds': 'Danh sách các nguồn báo & RSS',
    'report.mode': 'Chế độ báo cáo mặc định',
    'report.display_mode': 'Tiêu chí nhóm tin trong báo cáo',
    'report.sort_by_position_first': 'Ưu tiên sắp xếp theo thứ hạng/vị trí',
    'report.rank_threshold': 'Ngưỡng làm nổi bật thứ hạng',
    'report.max_news_per_keyword': 'Số tin tối đa cho mỗi từ khóa (0 = không giới hạn)',
    'filter.method': 'Phương thức lọc tin tức',
    'filter.priority_sort_enabled': 'Sắp xếp thẻ theo mức độ ưu tiên',
    'ai_filter.batch_size': 'Số tiêu đề gửi AI trong mỗi lượt lọc',
    'ai_filter.batch_interval': 'Khoảng nghỉ giữa các lượt lọc AI (giây)',
    'ai_filter.min_score': 'Điểm phù hợp tối thiểu để giữ tin (0.0 - 1.0)',
    'ai_filter.reclassify_threshold': 'Ngưỡng kích hoạt phân loại lại toàn bộ (0.0 - 1.0)',
    'ai_filter.prompt_file': 'Tệp mẫu câu lệnh phân loại AI',
    'ai_filter.extract_prompt_file': 'Tệp mẫu trích xuất thẻ từ khóa ban đầu',
    'ai_filter.update_tags_prompt_file': 'Tệp mẫu cập nhật thẻ khi sở thích đổi',
    'display.region_order': 'Thứ tự hiển thị các khu vực tin',
    'display.regions.hotlist': 'Hiển thị khu vực bảng tin thịnh hành',
    'display.regions.new_items': 'Hiển thị khu vực tin mới xuất hiện',
    'display.regions.rss': 'Hiển thị khu vực tin từ nguồn RSS',
    'display.regions.standalone': 'Hiển thị khu vực tin riêng biệt',
    'display.regions.ai_analysis': 'Hiển thị khu vực phân tích tổng hợp của AI',
    'display.standalone.platforms': 'Các nền tảng hiển thị đầy đủ không lọc',
    'display.standalone.rss_feeds': 'Các nguồn RSS hiển thị đầy đủ không lọc',
    'display.standalone.max_items': 'Số tin tối đa hiển thị cho mỗi nguồn riêng',
    'notification.enabled': 'Bật gửi thông báo ra bên ngoài',
    'notification.channels.feishu.webhook_url': 'Địa chỉ Webhook Feishu / Lark',
    'notification.channels.dingtalk.webhook_url': 'Địa chỉ Webhook DingTalk',
    'notification.channels.wework.webhook_url': 'Địa chỉ Webhook WeCom (Doanh nghiệp WeChat)',
    'notification.channels.wework.msg_type': 'Định dạng tin nhắn WeCom',
    'notification.channels.telegram.bot_token': 'Token bot Telegram',
    'notification.channels.telegram.chat_id': 'ID nhóm hoặc người nhận Telegram',
    'notification.channels.email.from': 'Địa chỉ email gửi',
    'notification.channels.email.password': 'Mật khẩu email hoặc mật khẩu ứng dụng',
    'notification.channels.email.to': 'Danh sách email nhận thông báo',
    'notification.channels.email.smtp_server': 'Máy chủ gửi thư SMTP',
    'notification.channels.email.smtp_port': 'Cổng kết nối máy chủ SMTP',
    'notification.channels.ntfy.server_url': 'Địa chỉ máy chủ ntfy',
    'notification.channels.ntfy.topic': 'Tên kênh (Topic) ntfy',
    'notification.channels.ntfy.token': 'Mã xác thực riêng tư ntfy (nếu có)',
    'notification.channels.bark.url': 'Địa chỉ thiết bị Bark',
    'notification.channels.slack.webhook_url': 'Địa chỉ Webhook ứng dụng Slack',
    'notification.channels.generic_webhook.webhook_url': 'Địa chỉ Webhook chung (Discord, Matrix...)',
    'notification.channels.generic_webhook.payload_template': 'Mẫu định dạng nội dung gửi Webhook',
    'storage.backend': 'Hệ thống lưu trữ dữ liệu',
    'storage.formats.sqlite': 'Lưu vào cơ sở dữ liệu SQLite',
    'storage.formats.txt': 'Xuất báo cáo bản văn bản TXT',
    'storage.formats.html': 'Tạo trang web báo cáo HTML',
    'storage.local.data_dir': 'Thư mục lưu trữ dữ liệu cục bộ',
    'storage.local.retention_days': 'Số ngày lưu trữ trên máy (0 = giữ vĩnh viễn)',
    'storage.remote.retention_days': 'Số ngày lưu trữ từ xa (0 = giữ vĩnh viễn)',
    'storage.remote.endpoint_url': 'Địa chỉ máy chủ lưu trữ S3 / R2 / OSS',
    'storage.remote.bucket_name': 'Tên kho lưu trữ (Bucket)',
    'storage.remote.access_key_id': 'Mã khóa truy cập lưu trữ từ xa',
    'storage.remote.secret_access_key': 'Mật mã bí mật lưu trữ từ xa',
    'storage.remote.region': 'Vùng lưu trữ từ xa',
    'storage.pull.enabled': 'Tự động tải dữ liệu từ kho từ xa khi khởi động',
    'storage.pull.days': 'Số ngày dữ liệu gần nhất cần tải về',
    'ai.model': 'Mô hình AI sử dụng (nhà cung cấp/tên mô hình)',
    'ai.api_key': 'Khóa bí mật API của mô hình AI',
    'ai.api_base': 'Địa chỉ máy chủ API trung gian (API Base)',
    'ai.timeout': 'Thời gian chờ gọi AI tối đa (giây)',
    'ai.temperature': 'Độ phong phú/ngẫu nhiên của phản hồi AI',
    'ai.max_tokens': 'Giới hạn số token tối đa AI tạo ra',
    'ai.num_retries': 'Số lần thử gọi lại AI khi gặp lỗi',
    'ai.fallback_models': 'Danh sách các mô hình dự phòng khi mô hình chính lỗi',
    'ai_analysis.enabled': 'Bật tính năng phân tích tin bằng AI',
    'ai_analysis.language': 'Ngôn ngữ của báo cáo phân tích AI',
    'ai_analysis.prompt_file': 'Tệp hướng dẫn gợi ý phân tích tin tức',
    'ai_analysis.mode': 'Chế độ lấy dữ liệu cho phân tích AI',
    'ai_analysis.max_news_for_analysis': 'Số lượng tin tức tối đa đưa vào phân tích',
    'ai_analysis.include_rss': 'Bao gồm dữ liệu từ các nguồn RSS khi phân tích',
    'ai_analysis.include_standalone': 'Bao gồm dữ liệu từ khu vực hiển thị riêng',
    'ai_analysis.include_rank_timeline': 'Bổ sung diễn biến xếp hạng vào phân tích',
    'ai_translation.enabled': 'Bật tính năng dịch tiêu đề bằng AI',
    'ai_translation.language': 'Ngôn ngữ dịch tiêu đề sang',
    'ai_translation.prompt_file': 'Tệp hướng dẫn dịch thuật cho AI',
    'ai_translation.batch_size': 'Số tiêu đề dịch trong mỗi lượt',
    'ai_translation.batch_interval': 'Khoảng nghỉ giữa các đợt dịch (giây)',
    'ai_translation.scope.hotlist': 'Dịch tiêu đề bảng tin thịnh hành',
    'ai_translation.scope.rss': 'Dịch tiêu đề các bài viết RSS',
    'ai_translation.scope.standalone': 'Dịch tiêu đề các nguồn riêng biệt',
    'advanced.debug': 'Ghi nhật ký chi tiết phục vụ gỡ lỗi',
    'advanced.version_check_url': 'Địa chỉ kiểm tra phiên bản ứng dụng',
    'advanced.mcp_version_check_url': 'Địa chỉ kiểm tra phiên bản MCP',
    'advanced.configs_version_check_url': 'Địa chỉ kiểm tra phiên bản cấu hình',
    'advanced.crawler.request_interval': 'Khoảng cách giữa các lượt cào tin xu hướng (ms)',
    'advanced.crawler.use_proxy': 'Sử dụng proxy khi cào bảng tin xu hướng',
    'advanced.crawler.default_proxy': 'Địa chỉ proxy dùng cho trình cào',
    'advanced.rss.request_interval': 'Khoảng nghỉ giữa các lần tải RSS (ms)',
    'advanced.rss.timeout': 'Thời gian chờ tối đa khi tải RSS (giây)',
    'advanced.rss.use_proxy': 'Sử dụng proxy khi lấy tin RSS',
    'advanced.rss.proxy_url': 'Địa chỉ proxy riêng cho nguồn tin RSS',
    'advanced.weight.rank': 'Trọng số thứ tự xếp hạng của tin',
    'advanced.weight.frequency': 'Trọng số tần suất xuất hiện của từ khóa',
    'advanced.weight.hotness': 'Trọng số độ nóng của tin trên bảng xếp hạng',
    'advanced.max_accounts_per_channel': 'Số tài khoản tối đa trên mỗi kênh thông báo',
    'advanced.batch_size.default': 'Kích thước gói tin mặc định gửi thông báo',
    'advanced.batch_size.dingtalk': 'Kích thước gói tin gửi DingTalk',
    'advanced.batch_size.feishu': 'Kích thước gói tin gửi Feishu',
    'advanced.batch_size.bark': 'Kích thước gói tin gửi Bark',
    'advanced.batch_size.slack': 'Kích thước gói tin gửi Slack',
    'advanced.batch_send_interval': 'Khoảng nghỉ giữa các đợt gửi thông báo (giây)',
    'advanced.feishu_message_separator': 'Chuỗi phân tách các đoạn tin Feishu'
  };

  /* ─────────────────────────────────────────────────────────────
   * 3. options: Giá trị danh sách chọn (enums dựa trên loader & scheduler)
   * ───────────────────────────────────────────────────────────── */
  var options = {
    /* Chế độ báo cáo: current, incremental, daily */
    'report.mode': [
      { value: 'current', label: 'Bảng tin hiện tại (tất cả tin đang có trên bảng tin)' },
      { value: 'incremental', label: 'Tin mới tăng thêm (chỉ tin mới xuất hiện, tránh trùng)' },
      { value: 'daily', label: 'Tổng hợp cả ngày (toàn bộ tin tức đã gom trong ngày)' }
    ],
    report_mode: [
      { value: 'current', label: 'Bảng tin hiện tại' },
      { value: 'incremental', label: 'Tin mới tăng thêm' },
      { value: 'daily', label: 'Tổng hợp cả ngày' }
    ],

    /* Chế độ hiển thị phân nhóm: keyword, platform */
    'report.display_mode': [
      { value: 'keyword', label: 'Gom theo nhóm từ khóa / chủ đề' },
      { value: 'platform', label: 'Gom theo từng nền tảng / nguồn tin' }
    ],
    display_mode: [
      { value: 'keyword', label: 'Gom theo từ khóa' },
      { value: 'platform', label: 'Gom theo nền tảng' }
    ],

    /* Phương thức lọc tin: keyword, ai */
    'filter.method': [
      { value: 'keyword', label: 'Khớp từ khóa thông thường (frequency_words.txt)' },
      { value: 'ai', label: 'Lọc ngữ nghĩa thông minh bằng AI (ai_interests.txt)' }
    ],
    method: [
      { value: 'keyword', label: 'Từ khóa' },
      { value: 'ai', label: 'Trí tuệ nhân tạo (AI)' }
    ],

    /* Chế độ phân tích AI: follow_report, daily, current, incremental */
    'ai_analysis.mode': [
      { value: 'follow_report', label: 'Tự động theo chế độ báo cáo (Khuyên dùng)' },
      { value: 'daily', label: 'Tổng hợp phân tích toàn bộ tin trong ngày' },
      { value: 'current', label: 'Chỉ phân tích bảng tin hiện tại' },
      { value: 'incremental', label: 'Chỉ phân tích các tin tức mới phát sinh' }
    ],
    ai_mode: [
      { value: 'follow_report', label: 'Theo chế độ báo cáo' },
      { value: 'daily', label: 'Tổng hợp cả ngày' },
      { value: 'current', label: 'Bảng tin hiện tại' },
      { value: 'incremental', label: 'Tin mới tăng thêm' }
    ],

    /* Hệ thống lưu trữ: auto, local, remote */
    'storage.backend': [
      { value: 'auto', label: 'Tự động xác định (Ưu tiên từ xa nếu có thiết lập)' },
      { value: 'local', label: 'Chỉ lưu trữ trên máy cục bộ' },
      { value: 'remote', label: 'Lưu trữ đám mây tương thích S3 (R2, OSS...)' }
    ],
    backend: [
      { value: 'auto', label: 'Tự động' },
      { value: 'local', label: 'Cục bộ' },
      { value: 'remote', label: 'Từ xa (S3)' }
    ],

    /* Loại tin nhắn gửi WeCom: markdown, text */
    'notification.channels.wework.msg_type': [
      { value: 'markdown', label: 'Định dạng Markdown (Dành cho bot nhóm)' },
      { value: 'text', label: 'Dạng văn bản thuần (Dành cho ứng dụng doanh nghiệp)' }
    ],
    msg_type: [
      { value: 'markdown', label: 'Markdown' },
      { value: 'text', label: 'Văn bản (Text)' }
    ],

    /* Chính sách khi trùng khung giờ: error_on_overlap, last_wins */
    'overlap.policy': [
      { value: 'error_on_overlap', label: 'Báo lỗi để tránh trùng lặp (Khuyên dùng)' },
      { value: 'last_wins', label: 'Ưu tiên khung giờ được định nghĩa sau' }
    ],
    policy: [
      { value: 'error_on_overlap', label: 'Báo lỗi khi trùng khung' },
      { value: 'last_wins', label: 'Ưu tiên khung giờ ghi sau' }
    ],

    /* Chế độ lịch có sẵn trong timeline */
    'schedule.preset': [
      { value: 'always_on', label: 'Theo dõi cả ngày (Gửi khi có tin mới)' },
      { value: 'morning_evening', label: 'Tổng hợp sáng và tối (Khuyên dùng)' },
      { value: 'office_hours', label: 'Giờ làm việc (Đầu giờ, trưa, cuối ngày)' },
      { value: 'night_owl', label: 'Chế độ làm việc khuya' },
      { value: 'custom', label: 'Tùy chỉnh lịch trong timeline.yaml' }
    ]
  };

  /* ─────────────────────────────────────────────────────────────
   * 4. help: Lời giải thích, lưu ý an toàn dữ liệu, cảnh báo phí & hành vi
   * ───────────────────────────────────────────────────────────── */
  var help = {
    /* Cảnh báo an toàn dữ liệu — Giữ nguyên tắc an toàn dữ liệu nghiêm ngặt */
    retention_days:
      'Số ngày lưu trữ tin tức. Lưu ý an toàn: Đặt giá trị lớn hơn 0 sẽ khiến hệ thống tự động xóa bỏ các dữ liệu tin tức cũ hơn số ngày chỉ định; đặt 0 để lưu giữ toàn bộ dữ liệu vĩnh viễn và không bị xóa.',
    'storage.local.retention_days':
      'Thời gian lưu trữ dữ liệu trên máy tính. Đặt 0 để giữ vĩnh viễn. Đặt số ngày khác 0 sẽ khiến hệ thống tự động dọn dẹp và xóa các tệp cơ sở dữ liệu cũ hơn số ngày này.',
    'storage.remote.retention_days':
      'Thời gian lưu trữ dữ liệu trên kho lưu trữ đám mây. Đặt 0 để giữ vĩnh viễn. Đặt số ngày khác 0 có thể dẫn đến việc tự động dọn dẹp xóa dữ liệu cũ từ xa.',

    /* Cảnh báo chi phí AI */
    'ai.api_key':
      'Khóa API kết nối dịch vụ AI. Khóa này có thể phát sinh phí dịch vụ từ nhà cung cấp mô hình khi sử dụng. Không chia sẻ hoặc để lộ khóa bí mật.',
    'ai_analysis.enabled':
      'Bật tính năng phân tích tin tức bằng AI. Tính năng này tiêu tốn token và có thể phát sinh chi phí từ dịch vụ AI theo khối lượng tin được phân tích.',
    'ai_filter.min_score':
      'Điểm số ngữ nghĩa tối thiểu (0.0 đến 1.0) để AI giữ lại một bài viết. Điểm càng cao thì yêu cầu bài viết càng phải khớp chính xác với sở thích trong ai_interests.txt.',
    'ai_translation.enabled':
      'Bật tính năng dịch tiêu đề tin tức tự động bằng AI. Có thể phát sinh thêm chi phí dịch vụ AI cho từng lượt gọi dịch tiêu đề.',

    /* Cảnh báo kênh thông báo tự động */
    'notification.enabled':
      'Công tắc tổng của hệ thống gửi thông báo. Khi tắt, ứng dụng sẽ hoàn toàn không gửi thông báo ra bất kỳ kênh bên ngoài nào. Trong các lượt chạy thủ công từ giao diện máy cục bộ, hệ thống mặc định khóa gửi thông báo để tránh làm phiền trừ khi được đánh dấu cho phép riêng.',

    /* Giải thích tính chất lịch trình không tự kích hoạt */
    'schedule.enabled':
      'Áp dụng lịch xử lý theo khung giờ. Lưu ý: Lịch này chỉ quyết định cách xử lý dữ liệu (thu thập, phân tích hay báo cáo) tại thời điểm có một lượt chạy được gọi. Ứng dụng cục bộ không tự động cài đặt bộ hẹn giờ chạy ngầm; bạn cần bấm "Lấy tin mới" hoặc thiết lập cron/tác vụ định kỳ riêng.',
    'schedule.preset':
      'Mẫu khung giờ có sẵn từ timeline.yaml. Tùy thuộc vào thời điểm bạn bấm lấy tin mà hệ thống sẽ áp dụng cấu hình tương ứng trong khung giờ đó.',

    /* Các ghi chú khác */
    'app.timezone':
      'Múi giờ dùng để hiển thị thời gian trong báo cáo, đặt tên tệp dữ liệu SQLite và so khớp với các khung giờ trong lịch trình timeline.yaml (ví dụ: Asia/Ho_Chi_Minh).',
    'platforms.api_url':
      'Địa chỉ dịch vụ API cung cấp dữ liệu bảng xếp hạng thịnh hành. Nếu sử dụng dịch vụ mặc định công khai thì có thể để trống.',
    'filter.method':
      'Chọn "keyword" để lọc tin nhanh dựa vào từ khóa trong config/frequency_words.txt (không tốn chi phí). Chọn "ai" để sử dụng mô hình trí tuệ nhân tạo đánh giá theo config/ai_interests.txt (có phát sinh chi phí gọi AI).'
  };

  return {
    sections: sections,
    fields: fields,
    options: options,
    help: help
  };
});
