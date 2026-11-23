# 🚀 YANZIOE VIP v1.2.9 — IOE.vn Auto Answer & Revealer

> Tool hỗ trợ học tập và hiển thị gợi ý đáp án Olympic Tiếng Anh trên Internet (IOE.vn), tích hợp bộ phân tích **Adobe Animate / CreateJS HTML5 Canvas**, Local English CAS 0ms, AI Vision/Text Solver (Groq / Gemini / OpenRouter), HUD nổi Dark Glassmorphism và chế độ Auto-Answer thông minh.

---

### ⚡ Bookmarklet (`javascript:`)
Tạo một Bookmark trên trình duyệt với URL sau (chạy trực tiếp trên mọi trang web IOE mà không cần cài extension):
```js
javascript:fetch("https://raw.githubusercontent.com/BaoNamYz/YANZIOE/main/YANZIOE.user.js").then(r=>r.text()).then(eval);
```

---

### 📦 Các cách cài đặt

#### Cách 1: Tampermonkey / Violentmonkey (Khuyên dùng)
1. Cài đặt tiện ích mở rộng [Tampermonkey](https://www.tampermonkey.net/) trên Chrome, Edge, Cốc Cốc hoặc Firefox.
2. Cài đặt script trực tiếp từ link Raw:
   👉 **[Cài đặt YANZIOE.user.js](https://raw.githubusercontent.com/BaoNamYz/YANZIOE/main/YANZIOE.user.js)**
3. Truy cập vào [https://ioe.vn/](https://ioe.vn/) hoặc các trang tự luyện / bài thi. Menu sẽ tự động kích hoạt ở góc phải màn hình!

#### Cách 2: Chrome Extension (Manifest v3)
1. Tải về thư mục tiện ích đã giải nén: `YANZIOE_Extension/` (hoặc bản VIP `YANZIOE_Extension_CoKey`).
2. Mở trình duyệt và truy cập `chrome://extensions/` (hoặc `coccoc://extensions/`).
3. Bật công tắc **Developer mode** (Chế độ dành cho nhà phát triển).
4. Nhấn **Load unpacked** (Tải tiện ích đã giải nén) và chọn thư mục `YANZIOE_Extension/`.

---

### 🎯 Tính năng nổi bật

- 🎮 **Hỗ trợ toàn diện CreateJS / EaselJS Canvas**: Tự động duyệt cây đối tượng đồ họa `window.stage` và `window.exportRoot` trong các trò chơi Flash/HTML5 kinh điển của IOE:
  - *Thủ môn bắt bóng (Defeat the Goal Keeper)*
  - *Khỉ thông minh (Smart Monkey)*
  - *Sắp xếp trật tự từ (Word Reordering / What's the order)*
  - *Điền từ vào chỗ trống (Fill in the blanks)*
- 🧠 **0ms Instant Thinking Engine**: Tự động giải trình tư duy phân tích ngữ pháp, xác định chủ ngữ, động từ chính và ngữ cảnh câu hỏi trong 0ms.
- ⚡ **Local English CAS**: Tự động tra cứu và chia động từ bất quy tắc, biến đổi từ loại, ngữ pháp thông dụng mà không cần gửi request mạng.
- 🤖 **Multi-Provider AI Solver**: Hỗ trợ kết nối API Groq (Llama 3.3 70B), Gemini, OpenRouter để giải quyết 100% các câu hỏi suy luận chuyên sâu và ngữ cảnh phức tạp.
- 🎨 **Giao diện Dark Glassmorphism Scoped**: Menu cấu hình hiện đại, Logo RGB động, HUD thu gọn nổi, phím tắt `Alt + H` và chế độ Stream Mode che giấu giao diện khi quay màn hình.

---

### 🛠️ Hướng dẫn Build từ Source Code

Dự án được viết theo kiến trúc modular chuẩn:
```text
YanzIOE/
├── functions/
│   ├── answerRevealer.js   # Floating HUD pill & 0ms thinking panel
│   ├── autoAnswer.js       # Auto-fill & auto-submit controller
│   ├── canvasEngine.js     # CreateJS / Adobe Animate Canvas scanner
│   ├── oneko.js            # Retro desktop cat follower
│   └── questionSpoof.js    # Network packet sniffer, Local CAS & AI
├── utils/
│   └── utils.js            # Toast, Event Emitter, DOM Observer
├── visuals/
│   └── mainMenu.js         # Glassmorphism settings panel & hotkeys
├── YANZIOE_Extension/      # Manifest v3 extension
├── build.py                # Compiler & Packager
├── HUONG_DAN_CAI_DAT_KoKey.txt
├── hd_lay_keyapi.txt
├── LICENSE
├── README.md
└── VERSION.txt
```

Để đóng gói ra toàn bộ bản phân phối (Full, KoKey, Extension, ZIP):
```bash
python build.py
```

---

### 📜 Bản quyền & Miễn trừ trách nhiệm (Disclaimer)
- Dự án được phát hành theo giấy phép **GNU General Public License v3.0** (xem file [LICENSE](LICENSE)).
- Sản phẩm được phát triển cho mục đích nghiên cứu học tập kỹ thuật lập trình web, phân tích đồ họa Canvas HTML5 và hỗ trợ học sinh tự ôn tập tiếng Anh. Vui lòng sử dụng có trách nhiệm và tuân thủ các quy chế học tập.
