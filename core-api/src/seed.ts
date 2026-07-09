/**
 * Seed du lịch Việt Nam — WIPE toàn bộ dữ liệu cũ rồi tạo mới.
 *
 * Tạo: 1000 user (traveler{i}@vn.seed / password123), 1 KOL 500 follower,
 * ~2400 bài viết du lịch (2–3 bài/user) với ảnh upload lên SeaweedFS, kèm
 * reaction + comment nhẹ. Ảnh lấy từ core-api/seed-assets/<Vùng>/<địa danh>/.
 *
 * Chạy: bảo đảm DB + Redis + SeaweedFS đang chạy → `npm run seed`.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

import { User } from './modules/users/entities/user.entity';
import { Post } from './modules/posts/entities/post.entity';
import { Relation } from './modules/users/relations/entities/relation.entity';
import { Reaction } from './modules/posts/reactions/entities/reaction.entity';
import { Comment } from './modules/posts/comments/entities/comment.entity';
import { RelationType } from './common/enums/relation.enum';
import { PrivacyType } from './common/enums/privacy.enum';
import { ReactionType } from './common/enums/reaction.enum';
import { MediaService } from './infra/media/media.service';

// ─────────────────────────────── Cấu hình ───────────────────────────────
const TOTAL_USERS = 1000;
const KOL_FOLLOWERS = 500;
const IMAGES_PER_LANDMARK_CAP = 120; // upload tối đa mỗi địa danh (ảnh tái dùng)
const UPLOAD_CONCURRENCY = 8;
const INSERT_CHUNK = 500;
const POST_DAYS_SPREAD = 120;
const SEED_ASSETS_ROOT = path.resolve(__dirname, '..', 'seed-assets');
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

interface Landmark {
  region: string;
  dir: string; // "<Vùng>/<địa danh>" — khớp thư mục thật trong seed-assets
  name: string;
  hashtags: string[];
  captions: string[];
  count: number;
}

// Danh sách địa danh THẬT + số bài (đã áp yêu cầu: tăng ĐN/HN/Tây Bắc; giảm Cô Tô/Bến Thành/Đức Bà)
const LANDMARKS: Landmark[] = [
  // ───────── Đà Nẵng (ưu tiên) ─────────
  {
    region: 'Đà Nẵng', dir: 'DaNang/hoi-an', name: 'Phố cổ Hội An', count: 200,
    hashtags: ['HoiAn', 'DaNang', 'PhoCoHoiAn'],
    captions: [
      'Hội An lên đèn, cả con phố nhuộm màu vàng của những chiếc đèn lồng 🏮 Bình yên đến lạ.',
      'Đi bộ trong phố cổ Hội An buổi chiều, ghé quán cao lầu, thả đèn hoa đăng trên sông Hoài.',
      'Những bức tường vàng rêu phong ở Hội An chụp góc nào cũng ra ảnh đẹp 📸',
      'Sáng sớm Hội An vắng người, chỉ có tiếng xe đạp và mùi cà phê. Yêu thành phố này thật.',
      'Chùa Cầu, đèn lồng và một bát mì Quảng nóng hổi — Hội An trọn vẹn là đây.',
    ],
  },
  {
    region: 'Đà Nẵng', dir: 'DaNang/ba-na-hills', name: 'Bà Nà Hills', count: 180,
    hashtags: ['BaNaHills', 'CauVang', 'DaNang'],
    captions: [
      'Cầu Vàng Bà Nà Hills — đôi bàn tay khổng lồ nâng cả bầu trời ☁️ Không thực tế mà có thật!',
      'Săn mây trên đỉnh Bà Nà, một ngày có đủ bốn mùa. Lạnh nhưng đã!',
      'Làng Pháp ở Bà Nà Hills đẹp như trời Âu thu nhỏ 🇫🇷 Đi cáp treo view triệu đô.',
      'Mây luồn qua Cầu Vàng, cảm giác như đang bước đi giữa tầng mây.',
      'Bà Nà Hills không bao giờ làm mình thất vọng, mỗi lần đến là một cảm xúc khác.',
    ],
  },
  {
    region: 'Đà Nẵng', dir: 'DaNang/my-khe', name: 'Biển Mỹ Khê', count: 120,
    hashtags: ['MyKhe', 'BienMyKhe', 'DaNang'],
    captions: [
      'Biển Mỹ Khê sáng sớm, nước trong veo, cát mịn — một trong những bãi biển đẹp nhất hành tinh 🌊',
      'Bình minh trên biển Mỹ Khê, mặt trời đỏ au nhô lên khỏi mặt nước. Đáng để dậy sớm!',
      'Chiều tà ở Mỹ Khê, gió mát, sóng vỗ, chỉ muốn ngồi mãi không về.',
      'Tắm biển Mỹ Khê xong làm ly nước dừa, còn gì bằng ☀️',
      'Đà Nẵng có biển xanh cát trắng nắng vàng, Mỹ Khê là số một trong tim mình.',
    ],
  },
  {
    region: 'Đà Nẵng', dir: 'DaNang/son-tra', name: 'Bán đảo Sơn Trà', count: 100,
    hashtags: ['SonTra', 'BanDaoSonTra', 'DaNang'],
    captions: [
      'Bán đảo Sơn Trà nhìn xuống cả thành phố Đà Nẵng, xanh mướt và trong lành 🌿',
      'Đường lên Sơn Trà uốn lượn, thi thoảng gặp cả đàn voọc chà vá chân nâu quý hiếm.',
      'Ngắm hoàng hôn từ đỉnh Bàn Cờ trên Sơn Trà, cả vịnh biển vàng rực.',
      'Cây đa ngàn năm ở Sơn Trà — chứng nhân của bao mùa gió biển.',
      'Sơn Trà là lá phổi xanh của Đà Nẵng, đi một lần là mê.',
    ],
  },
  {
    region: 'Đà Nẵng', dir: 'DaNang/ngu-hanh-son', name: 'Ngũ Hành Sơn', count: 90,
    hashtags: ['NguHanhSon', 'DaNang'],
    captions: [
      'Ngũ Hành Sơn — năm ngọn núi đá vôi giữa lòng Đà Nẵng, huyền bí và cổ kính ⛰️',
      'Leo lên động Huyền Không ở Ngũ Hành Sơn, ánh sáng rọi từ trên xuống đẹp như cổ tích.',
      'Ngũ Hành Sơn nhìn ra biển, vừa có núi vừa có sông, phong cảnh hữu tình.',
      'Làng đá mỹ nghệ Non Nước dưới chân Ngũ Hành Sơn, nghệ nhân tài hoa thật sự.',
      'Một buổi sáng vãn cảnh chùa ở Ngũ Hành Sơn, lòng nhẹ tênh.',
    ],
  },
  {
    region: 'Đà Nẵng', dir: 'DaNang/chua-linh-ung', name: 'Chùa Linh Ứng', count: 70,
    hashtags: ['ChuaLinhUng', 'SonTra', 'DaNang'],
    captions: [
      'Chùa Linh Ứng Sơn Trà với tượng Phật Bà Quan Âm cao nhất Việt Nam 🙏',
      'Đứng ở chùa Linh Ứng nhìn ra biển Đà Nẵng, bình an đến lạ thường.',
      'Tượng Quan Âm ở Linh Ứng hướng ra biển, như che chở cho ngư dân ra khơi.',
      'Chùa Linh Ứng buổi sớm, sương còn giăng, tiếng chuông chùa vang vọng.',
      'Ghé Linh Ứng cầu bình an cho gia đình, view thì khỏi bàn 🌊',
    ],
  },
  // ───────── Hà Nội (ưu tiên) ─────────
  {
    region: 'Hà Nội', dir: 'HaNoi/Pho-co-Ha-Noi', name: 'Phố cổ Hà Nội', count: 120,
    hashtags: ['PhoCoHaNoi', 'HaNoi', '36PhoPhuong'],
    captions: [
      '36 phố phường Hà Nội, mỗi con phố một nghề, đi hoài không hết chuyện 🏙️',
      'Phố cổ Hà Nội buổi tối, cà phê trứng, tàu điện và tiếng rao đêm. Rất Hà Nội.',
      'Lang thang phố cổ, ăn phở gánh, uống trà đá vỉa hè — bình dị mà thương.',
      'Những mái ngói rêu phong phố cổ Hà Nội, trầm mặc giữa phố xá ồn ào.',
      'Mùa thu Hà Nội, lá vàng rơi trên phố cổ, đẹp nao lòng 🍂',
    ],
  },
  {
    region: 'Hà Nội', dir: 'HaNoi/Ho-Guom', name: 'Hồ Gươm', count: 110,
    hashtags: ['HoGuom', 'HoanKiem', 'HaNoi'],
    captions: [
      'Hồ Gươm sáng sớm, tháp Rùa soi bóng nước, cụ già tập thể dục — trái tim của Hà Nội ❤️',
      'Cầu Thê Húc đỏ rực dẫn vào đền Ngọc Sơn, biểu tượng ngàn năm của Thủ đô.',
      'Đi bộ quanh Hồ Gươm cuối tuần, phố đi bộ đông vui mà vẫn thư thái.',
      'Hồ Gươm về đêm lung linh ánh đèn, đôi lứa dạo bước bên hồ.',
      'Một vòng Hồ Gươm là thấy cả hồn Hà Nội xưa và nay.',
    ],
  },
  {
    region: 'Hà Nội', dir: 'HaNoi/Van-Mieu', name: 'Văn Miếu - Quốc Tử Giám', count: 85,
    hashtags: ['VanMieu', 'QuocTuGiam', 'HaNoi'],
    captions: [
      'Văn Miếu Quốc Tử Giám — trường đại học đầu tiên của Việt Nam, ngàn năm hiếu học 📜',
      'Bia tiến sĩ ở Văn Miếu, mỗi tấm bia là một câu chuyện về truyền thống khoa bảng.',
      'Mùa xuân xin chữ ông đồ ở Văn Miếu, nét mực tàu thắm đượm hồn Việt.',
      'Không gian cổ kính, trầm mặc ở Văn Miếu, rất hợp để đi chậm và ngẫm.',
      'Ghé Văn Miếu trước mùa thi, cầu một chút may mắn cho sĩ tử 🖋️',
    ],
  },
  {
    region: 'Hà Nội', dir: 'HaNoi/Ho-tay', name: 'Hồ Tây', count: 80,
    hashtags: ['HoTay', 'HaNoi'],
    captions: [
      'Hoàng hôn Hồ Tây, mặt hồ mênh mông nhuộm tím, đạp xe một vòng là ghiền 🌅',
      'Chiều Hồ Tây gió lộng, ngồi ăn bánh tôm, ngắm thuyền trên hồ.',
      'Mùa sen Hồ Tây thơm ngát, ướp một ấm trà sen là cả mùa hè Hà Nội.',
      'Cà phê ven Hồ Tây, ngắm mặt trời lặn sau chùa Trấn Quốc.',
      'Hồ Tây rộng nhất Hà Nội, chỗ nào cũng có thể sống chậm một chút.',
    ],
  },
  {
    region: 'Hà Nội', dir: 'HaNoi/Lang-Chu-Tich', name: 'Lăng Chủ tịch Hồ Chí Minh', count: 75,
    hashtags: ['LangBac', 'LangChuTich', 'HaNoi'],
    captions: [
      'Vào Lăng viếng Bác, không khí trang nghiêm, lòng thành kính vô cùng 🇻🇳',
      'Quảng trường Ba Đình lộng gió, nơi Bác đọc Tuyên ngôn Độc lập năm 1945.',
      'Lễ thượng cờ sáng sớm ở Lăng Bác, ai cũng lặng người xúc động.',
      'Nhà sàn và ao cá Bác Hồ giản dị mà thấm thía biết bao bài học.',
      'Một lần đến Lăng Bác là một lần thêm yêu Tổ quốc.',
    ],
  },
  // ───────── Tây Bắc (ưu tiên) ─────────
  {
    region: 'Tây Bắc', dir: 'TayBac/Sapa', name: 'Sa Pa', count: 210,
    hashtags: ['Sapa', 'LaoCai', 'TayBac'],
    captions: [
      'Sa Pa mùa lúa chín, ruộng bậc thang vàng óng cả một triền đồi 🌾 Đẹp không nói nên lời.',
      'Săn mây ở Sa Pa, biển mây bồng bềnh dưới chân, cảm giác chạm tới trời.',
      'Bản Cát Cát, những nếp nhà người Mông giữa núi rừng Tây Bắc.',
      'Sa Pa se lạnh, làm nồi lẩu cá hồi, ngắm sương giăng khắp thị trấn.',
      'Đỉnh Fansipan hùng vĩ nhìn từ Sa Pa, nóc nhà Đông Dương gọi tên ⛰️',
      'Chợ phiên Sa Pa rực rỡ sắc màu thổ cẩm, ríu rít tiếng người vùng cao.',
    ],
  },
  {
    region: 'Tây Bắc', dir: 'TayBac/Ha-giang', name: 'Hà Giang', count: 170,
    hashtags: ['HaGiang', 'TayBac', 'CaoNguyenDa'],
    captions: [
      'Hà Giang mùa hoa tam giác mạch, cả cao nguyên đá nở hồng tím 🌸',
      'Đèo Mã Pí Lèng — một trong tứ đại đỉnh đèo, dưới là dòng Nho Quế xanh ngọc.',
      'Cột cờ Lũng Cú, điểm cực Bắc thiêng liêng của Tổ quốc 🇻🇳',
      'Cao nguyên đá Đồng Văn, đá tai mèo trùng điệp, hùng vĩ đến nghẹt thở.',
      'Chạy xe máy trên cung đường Hà Giang, mỗi khúc cua là một khung trời mới.',
      'Nhà của Pao, phố cổ Đồng Văn — Hà Giang đẹp nao lòng người lữ khách.',
    ],
  },
  // ───────── Quảng Ninh ─────────
  {
    region: 'Quảng Ninh', dir: 'QuangNinh/Vinh-Ha-Long', name: 'Vịnh Hạ Long', count: 180,
    hashtags: ['HaLong', 'VinhHaLong', 'QuangNinh'],
    captions: [
      'Vịnh Hạ Long — kỳ quan thiên nhiên thế giới, hàng nghìn đảo đá kỳ vĩ giữa biển xanh 🐉',
      'Ngủ đêm trên du thuyền Hạ Long, sáng dậy giữa muôn trùng đảo đá, quá đã!',
      'Chèo kayak luồn qua các hang động Hạ Long, nước trong nhìn thấy đáy.',
      'Hoàng hôn buông trên vịnh Hạ Long, cả mặt biển ánh vàng.',
      'Hòn Trống Mái, hang Sửng Sốt — Hạ Long lúc nào cũng khiến mình trầm trồ.',
    ],
  },
  {
    region: 'Quảng Ninh', dir: 'QuangNinh/Chua-Yen-Tu', name: 'Yên Tử', count: 70,
    hashtags: ['YenTu', 'QuangNinh'],
    captions: [
      'Leo Yên Tử lên chùa Đồng, mây phủ khắp lối, đất Phật linh thiêng 🙏',
      'Yên Tử — kinh đô Phật giáo Trúc Lâm, từng bậc đá thấm mồ hôi hành hương.',
      'Trên đỉnh Yên Tử, chùa Đồng lấp lánh trong sương, cảm giác thật an yên.',
      'Rừng trúc Yên Tử xanh mướt, đi giữa thiên nhiên và tâm linh.',
      'Một chuyến Yên Tử đầu năm, cầu an cho cả nhà.',
    ],
  },
  {
    region: 'Quảng Ninh', dir: 'QuangNinh/quan-lan', name: 'Đảo Quan Lạn', count: 60,
    hashtags: ['QuanLan', 'QuangNinh'],
    captions: [
      'Quan Lạn — hòn đảo hoang sơ, bãi biển dài cát trắng vắng người 🏖️',
      'Biển Quan Lạn trong xanh, buổi sáng chỉ có mình và tiếng sóng.',
      'Đạp xe quanh đảo Quan Lạn, ghé bãi Minh Châu tắm biển.',
      'Hải sản Quan Lạn tươi rói, sá sùng nổi tiếng khắp nơi.',
      'Trốn phố về Quan Lạn vài ngày, chữa lành thật sự.',
    ],
  },
  {
    region: 'Quảng Ninh', dir: 'QuangNinh/Co-To', name: 'Đảo Cô Tô', count: 20,
    hashtags: ['CoTo', 'QuangNinh'],
    captions: [
      'Cô Tô nước biển xanh như ngọc, một trong những đảo đẹp nhất miền Bắc 🌊',
      'Ngắm bình minh ở bãi Hồng Vàn, Cô Tô yên bình đến lạ.',
      'Con đường tình yêu ở Cô Tô, đi bộ ven biển thật lãng mạn.',
      'Cô Tô mùa hè, trời trong, biển lặng, cá tươi.',
      'Trốn nắng thành phố ra Cô Tô hít thở khí biển.',
    ],
  },
  // ───────── Hải Phòng ─────────
  {
    region: 'Hải Phòng', dir: 'HaiPhong/Cat-Ba', name: 'Đảo Cát Bà', count: 130,
    hashtags: ['CatBa', 'HaiPhong'],
    captions: [
      'Cát Bà — đảo ngọc của Hải Phòng, rừng quốc gia và biển xanh liền kề 🌴',
      'Vịnh Lan Hạ nhìn từ Cát Bà, đẹp không kém gì Hạ Long mà yên tĩnh hơn.',
      'Đứng trên pháo đài Thần Công, cả đảo Cát Bà thu vào tầm mắt.',
      'Cát Bà buổi tối, phố biển lên đèn, hải sản nướng thơm lừng.',
      'Trekking rừng quốc gia Cát Bà, không khí trong lành cực kỳ.',
    ],
  },
  {
    region: 'Hải Phòng', dir: 'HaiPhong/Vinh-Lan-Ha', name: 'Vịnh Lan Hạ', count: 80,
    hashtags: ['LanHa', 'CatBa', 'HaiPhong'],
    captions: [
      'Vịnh Lan Hạ — 400 hòn đảo lớn nhỏ, nước trong veo, hoang sơ đến nao lòng 💙',
      'Chèo kayak ở Lan Hạ, len lỏi giữa những hòn đảo đá vôi kỳ thú.',
      'Tắm biển ở những bãi cát nhỏ giấu mình trong vịnh Lan Hạ.',
      'Buổi chiều thả mình trên du thuyền vịnh Lan Hạ, bình yên tuyệt đối.',
      'Lan Hạ đẹp mà còn ít người biết, đi ngay khi còn hoang sơ.',
    ],
  },
  {
    region: 'Hải Phòng', dir: 'HaiPhong/TP-Hai-Phong', name: 'Thành phố Hải Phòng', count: 50,
    hashtags: ['HaiPhong', 'HoaPhuongDo'],
    captions: [
      'Hải Phòng mùa hoa phượng đỏ rực cả con đường, thành phố Hoa Phượng Đỏ 🌺',
      'Nhà hát lớn Hải Phòng cổ kính, kiến trúc Pháp giữa lòng thành phố cảng.',
      'Ăn bánh đa cua Hải Phòng chuẩn vị, ngon nhức nhối!',
      'Dạo phố Hải Phòng, cảng biển tấp nập, nhịp sống rất riêng.',
      'Hải Phòng — thành phố cảng năng động mà vẫn giữ nét xưa.',
    ],
  },
  // ───────── Nghệ An ─────────
  {
    region: 'Nghệ An', dir: 'NgheAn/Cua-Lo', name: 'Biển Cửa Lò', count: 60,
    hashtags: ['CuaLo', 'NgheAn'],
    captions: [
      'Biển Cửa Lò cát vàng, sóng êm, bãi biển đẹp nhất xứ Nghệ 🏖️',
      'Bình minh Cửa Lò, thuyền thúng ngư dân về bến đầy ắp cá.',
      'Ăn mực nhảy Cửa Lò tươi rói ngay bên bờ biển, hết sảy!',
      'Chiều Cửa Lò gió mát, dạo bộ trên bãi biển dài.',
      'Đảo Ngư nhìn từ Cửa Lo, biển trời một màu xanh ngắt.',
    ],
  },
  {
    region: 'Nghệ An', dir: 'NgheAn/QueBac', name: 'Quê Bác - Kim Liên', count: 40,
    hashtags: ['QueBac', 'KimLien', 'NgheAn'],
    captions: [
      'Về Làng Sen quê Bác, mái nhà tranh giản dị mà thiêng liêng 🇻🇳',
      'Kim Liên - Nam Đàn, nơi lưu giữ tuổi thơ của Chủ tịch Hồ Chí Minh.',
      'Cây đa, giếng nước, sân đình — quê Bác bình dị đến rưng rưng.',
      'Về nguồn ở Làng Sen, nghe kể chuyện thời niên thiếu của Bác.',
      'Một buổi sáng ở quê Bác, lòng thành kính và biết ơn.',
    ],
  },
  // ───────── TP.HCM (giảm Bến Thành & Đức Bà) ─────────
  {
    region: 'TP.HCM', dir: 'TpHCM/Nguyen-Hue', name: 'Phố đi bộ Nguyễn Huệ', count: 70,
    hashtags: ['NguyenHue', 'SaiGon', 'HoChiMinh'],
    captions: [
      'Phố đi bộ Nguyễn Huệ về đêm, Sài Gòn rực rỡ và trẻ trung 🌃',
      'Cuối tuần ra Nguyễn Huệ ngắm phố, cà phê bệt, nghe nhạc đường phố.',
      'Toà nhà UBND soi bóng trên phố Nguyễn Huệ, biểu tượng Sài Gòn.',
      'Nguyễn Huệ mùa lễ hội, hoa và ánh đèn khắp nơi, đông vui náo nhiệt.',
      'Sài Gòn không ngủ, và Nguyễn Huệ là nơi rõ nhất điều đó.',
    ],
  },
  {
    region: 'TP.HCM', dir: 'TpHCM/cho-ben-thanh', name: 'Chợ Bến Thành', count: 15,
    hashtags: ['ChoBenThanh', 'SaiGon'],
    captions: [
      'Chợ Bến Thành — biểu tượng trăm năm của Sài Gòn, cái gì cũng có 🛍️',
      'Ghé Bến Thành ăn hàng, mua đặc sản, cảm nhận nhịp sống Sài Gòn.',
      'Đồng hồ cổ chợ Bến Thành, điểm hẹn quen thuộc của người Sài Gòn.',
    ],
  },
  {
    region: 'TP.HCM', dir: 'TpHCM/Nha-tho-duc-ba', name: 'Nhà thờ Đức Bà', count: 15,
    hashtags: ['NhaThoDucBa', 'SaiGon'],
    captions: [
      'Nhà thờ Đức Bà Sài Gòn, kiến trúc Pháp cổ kính giữa lòng thành phố ⛪',
      'Chiều bên Nhà thờ Đức Bà, bồ câu bay rợp, cổ kính và bình yên.',
      'Nhà thờ Đức Bà và Bưu điện Thành phố — góc châu Âu giữa Sài Gòn.',
    ],
  },
];

// ─────────────────────────────── Tiện ích ───────────────────────────────
const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const TEN_DEM = ['Văn', 'Thị', 'Hữu', 'Đức', 'Minh', 'Ngọc', 'Thanh', 'Thu', 'Gia', 'Hải', 'Quang', 'Bảo', 'Kim', 'Anh'];
const TEN = ['An', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hà', 'Hùng', 'Hương', 'Khánh', 'Lan', 'Linh', 'Long', 'Mai', 'Nam', 'Nga', 'Ngân', 'Nhung', 'Phong', 'Phúc', 'Quân', 'Quỳnh', 'Sơn', 'Tâm', 'Thảo', 'Trang', 'Trung', 'Tú', 'Vy', 'Yến', 'Đạt'];

const COMMENTS = [
  'Đẹp quá! 😍', 'Muốn đi ngay!', 'Chỗ này ở đâu vậy bạn?', 'Lưu lại liền 📌',
  'View xịn thật sự', 'Quá tuyệt vời 👏', 'Cho mình xin lịch trình với ạ', 'Ảnh chụp đỉnh quá',
  'Nhìn là muốn xách balo lên đi', 'Sống ảo hết nước chấm 📸', 'Thèm đi du lịch quá đi mất',
  'Chỗ này mình cũng từng tới, đẹp mê', 'Cuối tuần này đi thôi mọi người ơi', 'Hết bao nhiêu tiền vậy bạn?',
];
const REPLIES = ['Đi liền đi bạn ơi!', 'Cảm ơn bạn nha 🥰', 'Để mình inbox cho', 'Chuẩn luôn!', 'Hehe cảm ơn nhiều', 'Đi chung không? 😄'];

// nghiêng LIKE/LOVE
const REACTION_POOL: ReactionType[] = [
  ReactionType.LIKE, ReactionType.LIKE, ReactionType.LIKE, ReactionType.LIKE,
  ReactionType.LOVE, ReactionType.LOVE, ReactionType.LOVE,
  ReactionType.HAHA, ReactionType.WOW, ReactionType.SAD, ReactionType.ANGRY,
];

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const sampleDistinct = <T,>(arr: T[], n: number): T[] => shuffle(arr).slice(0, Math.min(n, arr.length));

function slugifyName(full: string): string {
  return full
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function mimeFromExt(ext: string): string {
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function insertInChunks(dataSource: DataSource, entity: any, rows: any[]) {
  const repo = dataSource.getRepository(entity);
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    await repo.insert(rows.slice(i, i + INSERT_CHUNK));
  }
}

// ─────────────────────────────── Main ───────────────────────────────
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const mediaService = app.get(MediaService, { strict: false });

  console.log('════════════════════════════════════════════════');
  console.log('  SEED DU LỊCH — WIPE + tạo mới');
  console.log('════════════════════════════════════════════════');

  // ── 1) Upload ảnh theo từng địa danh (LÀM TRƯỚC khi wipe cho an toàn) ──
  console.log('\n[1] Upload ảnh lên SeaweedFS (mỗi ảnh 1 lần)...');
  const imagePool: Record<string, string[]> = {};
  for (const lm of LANDMARKS) {
    const dirPath = path.join(SEED_ASSETS_ROOT, lm.dir);
    if (!fs.existsSync(dirPath)) {
      console.warn(`    ⚠ Thiếu thư mục: ${lm.dir} → bỏ qua ${lm.count} bài`);
      imagePool[lm.dir] = [];
      continue;
    }
    const files = fs.readdirSync(dirPath)
      .filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
      .slice(0, IMAGES_PER_LANDMARK_CAP);
    if (files.length === 0) {
      console.warn(`    ⚠ Không có ảnh trong ${lm.dir} → bỏ qua`);
      imagePool[lm.dir] = [];
      continue;
    }
    const urls = await mapPool(files, UPLOAD_CONCURRENCY, async (fname) => {
      const full = path.join(dirPath, fname);
      const ext = path.extname(fname).toLowerCase();
      const file: any = {
        buffer: fs.readFileSync(full),
        mimetype: mimeFromExt(ext),
        originalname: fname,
      };
      try {
        return await mediaService.uploadFile(file, `seed/${lm.dir}`);
      } catch (e) {
        console.warn(`      ✗ upload lỗi ${fname}: ${(e as Error).message}`);
        return null;
      }
    });
    imagePool[lm.dir] = urls.filter((u): u is string => !!u);
    console.log(`    ✓ ${lm.dir}: ${imagePool[lm.dir].length}/${files.length} ảnh`);
  }

  const totalImages = Object.values(imagePool).reduce((s, a) => s + a.length, 0);
  if (totalImages === 0) {
    console.error('\n✗ Không upload được ảnh nào (SeaweedFS chưa chạy?). HUỶ seed, KHÔNG wipe dữ liệu.');
    await app.close();
    process.exit(1);
  }
  console.log(`    → Tổng ${totalImages} ảnh sẵn sàng.`);

  // ── 2) WIPE toàn bộ dữ liệu (sau khi chắc chắn có ảnh) ──
  console.log('\n[2] Xoá sạch toàn bộ dữ liệu cũ...');
  const tables: Array<{ tablename: string }> = await dataSource.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  if (tables.length > 0) {
    const list = tables.map((t) => `"${t.tablename}"`).join(', ');
    await dataSource.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  }
  console.log(`    Đã TRUNCATE ${tables.length} bảng.`);

  // ── 3) 1000 user ──
  console.log('\n[3] Tạo 1000 user...');
  const passwordHash = await bcrypt.hash('password123', 10); // hash 1 lần
  const users: any[] = [];
  const usedUsernames = new Set<string>();
  for (let i = 1; i <= TOTAL_USERS; i++) {
    let username: string;
    let fullName: string;
    if (i === 1) {
      username = 'vietnam_oi';
      fullName = 'Việt Nam Ơi';
    } else {
      fullName = `${pick(HO)} ${pick(TEN_DEM)} ${pick(TEN)}`;
      username = `${slugifyName(fullName)}${i}`;
    }
    if (usedUsernames.has(username)) username = `${username}_${i}`;
    usedUsernames.add(username);
    users.push({
      id: uuidv4(),
      email: `traveler${i}@vn.seed`,
      password: passwordHash,
      username,
      full_name: fullName,
      privacy: i === 1 ? PrivacyType.PUBLIC : (Math.random() < 0.1 ? PrivacyType.PRIVATE : PrivacyType.PUBLIC),
    });
  }
  await insertInChunks(dataSource, User, users);
  const KOL = users[0];
  console.log(`    ✓ ${users.length} user (KOL: ${KOL.email} / password123)`);

  // ── 4) Follow graph ──
  console.log('\n[4] Tạo quan hệ theo dõi...');
  const relSet = new Set<string>();
  const relations: any[] = [];
  const addFollow = (reqId: string, accId: string) => {
    if (reqId === accId) return;
    const key = `${reqId}:${accId}`;
    if (relSet.has(key)) return;
    relSet.add(key);
    relations.push({ request_side_id: reqId, accept_side_id: accId, relation_type: RelationType.FOLLOWING, is_restricted: false });
  };
  // KOL 500 follower (1 chiều)
  for (const f of sampleDistinct(users.slice(1), KOL_FOLLOWERS)) addFollow(f.id, KOL.id);
  // follow ngẫu nhiên nhẹ
  for (const u of users) {
    for (const target of sampleDistinct(users, rand(5, 15))) addFollow(u.id, target.id);
  }
  // đánh dấu is_mutual cho cặp 2 chiều
  for (const r of relations) {
    r.is_mutual = relSet.has(`${r.accept_side_id}:${r.request_side_id}`);
  }
  await insertInChunks(dataSource, Relation, relations);
  console.log(`    ✓ ${relations.length} quan hệ (KOL có ${KOL_FOLLOWERS} follower)`);

  // ── 5) Bài viết ──
  console.log('\n[5] Tạo bài viết...');
  const specs: Landmark[] = [];
  for (const lm of LANDMARKS) {
    if ((imagePool[lm.dir] || []).length === 0) continue; // thiếu ảnh → bỏ
    for (let k = 0; k < lm.count; k++) specs.push(lm);
  }
  shuffle(specs);

  const now = Date.now();
  const posts: any[] = [];
  const buildPost = (lm: Landmark, user: any) => {
    const tags = [...lm.hashtags]; // không kèm #DuLich/#Vietnam — đã là MXH du lịch VN
    // Nhúng hashtag vào CONTENT để hiển thị/tô sáng như bài viết thật.
    const content = `${pick(lm.captions)}\n\n${tags.map((h) => '#' + h).join(' ')}`;
    // Số ảnh mỗi bài: 70% một ảnh, 20% hai ảnh, 10% ba ảnh (giới hạn theo ảnh có).
    const pool = imagePool[lm.dir];
    const r = Math.random();
    const nImages = r < 0.1 ? 3 : r < 0.3 ? 2 : 1;
    const medias = sampleDistinct(pool, nImages);
    posts.push({
      id: uuidv4(),
      user_id: user.id,
      content,
      medias,
      hashtags: tags,
      tagged_users: [],
      privacy: PrivacyType.PUBLIC,
      created_at: new Date(now - Math.random() * POST_DAYS_SPREAD * 24 * 3600 * 1000),
    });
  };
  let si = 0;
  // KOL nhỉnh hơn
  const kolExtra = Math.min(12, specs.length);
  for (let k = 0; k < kolExtra; k++) buildPost(specs[si++], KOL);
  // phần còn lại chia đều 2–3 bài/user
  let ui = 1;
  while (si < specs.length) {
    buildPost(specs[si++], users[ui % TOTAL_USERS]);
    ui++;
  }
  await insertInChunks(dataSource, Post, posts);
  console.log(`    ✓ ${posts.length} bài viết`);

  // ── 6) Reaction + Comment ──
  console.log('\n[6] Tạo reaction + comment...');
  const reactions: any[] = [];
  const comments: any[] = [];
  for (const post of posts) {
    // reactions: 0–15 user khác nhau (khác tác giả)
    const nReact = rand(0, 15);
    if (nReact > 0) {
      const reactors = sampleDistinct(users, nReact + 5)
        .filter((u) => u.id !== post.user_id)
        .slice(0, nReact);
      for (const u of reactors) {
        reactions.push({ user_id: u.id, post_id: post.id, reaction: pick(REACTION_POOL) });
      }
    }
    // comments: 0–4, vài reply
    const nComment = rand(0, 4);
    const postComments: any[] = [];
    for (let c = 0; c < nComment; c++) {
      const commenter = pick(users);
      const id = uuidv4();
      const isReply = postComments.length > 0 && Math.random() < 0.3;
      comments.push({
        id,
        user_id: commenter.id,
        post_id: post.id,
        content: isReply ? pick(REPLIES) : pick(COMMENTS),
        parent_id: isReply ? pick(postComments).id : null,
      });
      postComments.push({ id });
    }
  }
  // chống trùng (user,post) cho reaction
  const seenReact = new Set<string>();
  const dedupReactions = reactions.filter((r) => {
    const k = `${r.user_id}:${r.post_id}`;
    if (seenReact.has(k)) return false;
    seenReact.add(k);
    return true;
  });
  await insertInChunks(dataSource, Comment, comments); // parent luôn đứng trước reply
  await insertInChunks(dataSource, Reaction, dedupReactions);
  console.log(`    ✓ ${dedupReactions.length} reaction, ${comments.length} comment`);

  console.log('\n════════════════════════════════════════════════');
  console.log('  HOÀN TẤT SEED');
  console.log(`  Users: ${users.length} | Posts: ${posts.length}`);
  console.log(`  Relations: ${relations.length} | Reactions: ${dedupReactions.length} | Comments: ${comments.length}`);
  console.log(`  Đăng nhập KOL: ${KOL.email} / password123`);
  console.log('════════════════════════════════════════════════');

  await app.close();
}

bootstrap().catch((err) => {
  console.error('Seeding failed', err);
  process.exit(1);
});
