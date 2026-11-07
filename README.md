<p align="center">
  <img src="public/logo.svg" width="96" height="96" alt="QRViet logo" />
</p>

<h1 align="center">QRViet — Tiện ích VietQR</h1>

<p align="center">
  Tạo, quét và chia sẻ mã <b>VietQR</b> chuyển khoản cho mọi ngân hàng &amp; ví Việt Nam.<br/>
  SPA thuần (không cần Node server) · PWA cài được · chạy <b>offline</b> · riêng tư 100%.
</p>

---

## Tính năng

| Nhóm | Chi tiết |
| --- | --- |
| **Tạo VietQR** | Chuẩn NAPAS 247 (EMVCo): tài khoản / thẻ, mã tĩnh – động, số tiền, nội dung, mã hoá đơn (62.01), mã tham chiếu (62.05), tên/thành phố (59/60). Kết quả khớp từng byte với `vietqr-core`. |
| **Nhập liệu thông minh** | Chọn ngân hàng có logo, tìm không dấu (`"a chau"` → ACB), yêu thích & gần đây · số tiền kiểu `150k`, `1tr2`, `2 triệu 300k` · đọc số tiền thành chữ (vi/en) + đọc to · tự bỏ dấu nội dung, đếm ký tự theo giới hạn 25 của NAPAS · tạo mã đơn ngẫu nhiên · dán số tài khoản từ clipboard. |
| **Mẫu ảnh** | VietQR (khung + logo ngân hàng) · Thẻ chuyển khoản · Tối giản · **Standee in quầy** (tỉ lệ A) · Chỉ mã QR. Màu chủ đạo, tiêu đề, che bớt số tài khoản, ẩn/hiện thương hiệu. |
| **Thiết kế mã** | 8 kiểu chấm, 5 khung mắt, 5 tâm mắt, gradient tuyến tính/toả tròn, màu mắt riêng, nền trong suốt, logo giữa (ngân hàng / QRViet / ảnh của bạn), mức sửa lỗi, lề. Tự nâng ECC khi có logo, cảnh báo tương phản thấp. |
| **Tự kiểm tra quét** | Mỗi lần đổi kiểu, mã được vẽ lại và **giải mã ngược** (BarcodeDetector/jsQR) để xác nhận vẫn quét được. |
| **Xuất & chia sẻ** | PNG / JPEG / WebP (2×–4×) / SVG vector · sao chép ảnh · Web Share (gửi thẳng sang Zalo, Messenger…) · in (A5) · phím tắt `Ctrl/⌘+S`. |
| **Quét & giải mã** | Camera (BarcodeDetector, dự phòng jsQR), đèn flash, đổi camera, quét liên tục · ảnh: chọn file, **dán ảnh chụp màn hình**, kéo-thả · dán chuỗi · nhận nội dung **chia sẻ từ app khác** (Web Share Target). Hiển thị ngân hàng, số tiền bằng chữ, CRC hợp lệ/sai, bảng trường EMV; “Sửa & tạo lại”, lưu tài khoản. Nhận diện cả URL, WiFi, vCard/MeCard, email, SMS, điện thoại, vị trí, sự kiện. |
| **Link thanh toán** | Trang thanh toán đẹp, dữ liệu nằm **trong `#` của URL** (không qua máy chủ): QR, sao chép từng trường, các bước hướng dẫn, đếm ngược hết hạn, lời nhắn, đọc số tiền. Kèm QR mở link để in. |
| **Tạo hàng loạt** | Dán từ Excel/CSV (tự nhận tab/;/,), sinh dãy tự động (Phòng 101…120), kiểm lỗi từng dòng, **tải ZIP** (PNG + CSV) hoặc **in tem nhãn A4** (2×3, 3×4, 4×5). |
| **QR đa năng** | Liên kết, văn bản, WiFi, danh thiếp vCard, mạng xã hội (Zalo, Facebook, TikTok…), email, SMS, gọi điện, vị trí, sự kiện; dòng chữ dưới mã; mã nhúng HTML. |
| **Dữ liệu của bạn** | Sổ tài khoản (màu thẻ, mặc định, nhập/xuất JSON, hoàn tác xoá) · Lịch sử (tìm, lọc, ghim, mở lại) · Danh bạ 76 ngân hàng & ví (BIN, mã, SWIFT, Napas 247). |
| **Tiện ích** | Kiểm tra chuỗi VietQR + sửa CRC · đọc số tiền thành chữ · chuẩn hoá nội dung CK · chia tiền nhóm · tính CRC16. |
| **Thương hiệu & giao diện** | Logo/biểu tượng riêng (3 ô định vị QR + chữ V + ngôi sao vàng) · 6 chủ đề QRViet + 7 chủ đề Astryx · **trình tạo chủ đề** (màu nhấn, tông nền, tương phản cao, bo góc, cỡ chữ, xem trước trực tiếp, xuất/nhập JSON) · sáng/tối/hệ thống · 4 phông hỗ trợ đầy đủ tiếng Việt · **Tiếng Việt (mặc định) & English**. |
| **PWA** | Cài như ứng dụng (Android/desktop + hướng dẫn iOS), shortcuts, share target, thông báo có bản mới, toàn bộ tài nguyên (kể cả logo ngân hàng & phông chữ) được precache để chạy offline. |
| **Tiện dụng** | Bảng lệnh `⌘/Ctrl+K`, `Shift+D` đổi sáng/tối, `Shift+S` mở trang quét · thanh tab dưới kiểu ứng dụng trên điện thoại · loader thương hiệu tôn trọng *reduced motion*. |

## Công nghệ

- **UI**: [Astryx](https://github.com/meta/astryx) (design system của Meta, React 19 + StyleX dựng sẵn) — AppShell, TopNav/SideNav/MobileNav, CommandPalette, Dialog/BottomSheet, Toast, Theme (`defineTheme` runtime cho theme-builder), i18n `vi-VN`… kết hợp Tailwind CSS v4 qua cầu nối token của Astryx.
- **TanStack**: Router (file-based, tự tách chunk, search params có kiểm tra) · Store (state + lưu `localStorage`, đồng bộ giữa các tab).
- **QR**: [`uqr`](https://github.com/unjs/uqr) để mã hoá (renderer SVG/Canvas tự viết) · `BarcodeDetector` + [`jsQR`](https://github.com/cozmo/jsQR) (tải lười) để giải mã.
- **PWA**: `vite-plugin-pwa` (Workbox `generateSW`) + `workbox-window`.
- Không có backend, không telemetry. Đã bỏ TanStack Start/Nitro/devtools, `zod` và `@modelcontextprotocol/sdk`.

## Bắt đầu

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # unit test lõi VietQR/EMV/tiền tệ/QR (node:test, không cần thư viện)
pnpm typecheck
pnpm build        # → dist/ (tĩnh hoàn toàn) + service worker
pnpm preview      # chạy thử bản build (có PWA/offline)
```

Yêu cầu Node ≥ 22.18 (chạy test TypeScript trực tiếp bằng type stripping) và pnpm.

## Triển khai (static hosting)

`dist/` là site tĩnh — đặt lên bất kỳ CDN nào:

- **Netlify / Cloudflare Pages**: đã có `public/_redirects` (`/* /index.html 200`).
- **GitHub Pages / Surge**: build tự sinh `404.html` để deep link hoạt động. Nếu chạy dưới thư mục con: `BASE_PATH=/ten-repo/ pnpm build`.
- **Vercel / Nginx**: cấu hình rewrite mọi đường dẫn về `/index.html`.

Camera và Service Worker cần **HTTPS** (hoặc `localhost`).

## Cấu trúc

```
src/
  lib/                 # Thuần TypeScript, không phụ thuộc React — có unit test
    emv.ts             #   TLV + CRC16-CCITT
    vietqr.ts          #   build/parse/validate VietQR (NAPAS)
    money.ts, text.ts  #   VND, "1tr2", đọc số thành chữ, bỏ dấu
    payloads.ts        #   WiFi/vCard/… + phân loại nội dung quét
    qr/render.ts       #   hình học QR có kiểu (path SVG dùng chung cho Canvas)
    qr/scene.ts        #   scene graph → SVG & Canvas
    qr/templates.ts    #   mẫu ảnh (VietQR, thẻ, standee…)
    qr/export.ts       #   PNG/SVG, clipboard, share, in
    scan.ts, zip.ts, paylink.ts, persist.ts
  routes/              # TanStack Router (file-based)
  components/          # brand, layout, bank, vietqr, qr, scan, settings
  stores/              # TanStack Store: settings, accounts, history, studio
  theme/               # preset & theme-builder (Astryx defineTheme), phông chữ
  i18n/                # vi.ts (gốc) + en.ts (kiểm tra kiểu đủ khoá)
  data/banks.json      # danh sách ngân hàng offline
public/banks/          # logo ngân hàng (WebP, precache)
scripts/sync-banks.mjs # cập nhật danh sách + logo từ api.vietqr.io (chạy khi cần)
```

Cập nhật danh sách ngân hàng: `pnpm sync:banks` (cần mạng; dùng `cwebp` nếu có để nén logo).

Tra cứu component Astryx ngay trong repo: `pnpm astryx component Button`, `pnpm astryx docs theme`.

## Quyền riêng tư

Mọi dữ liệu (sổ tài khoản, lịch sử, cài đặt) nằm trong `localStorage` của trình duyệt. Link thanh toán mang dữ liệu trong phần `#fragment` — trình duyệt không gửi phần này lên máy chủ. Có thể sao lưu/khôi phục/xoá toàn bộ trong **Cài đặt → Dữ liệu**.

## Ghi chú

QRViet là dự án độc lập, không liên kết với NAPAS, VietQR hay bất kỳ ngân hàng nào. Tên và logo ngân hàng thuộc về chủ sở hữu tương ứng; danh sách lấy từ API công khai của VietQR.
