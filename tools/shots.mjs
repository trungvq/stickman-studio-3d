// Chụp app xem thử ra PNG cho chủ dự án so bằng mắt: `pnpm shots [--out tên] [--vs tên] [--only a,b] [--q x=1] [--soft]`.
// Ảnh vào tmp/shots/<tên>/, tên mặc định là commit hiện tại (thêm `-dirty` khi cây có thay đổi), kèm một tờ gộp
// tmp/shots/<tên>.png. `--vs` ghép từng ảnh cạnh ảnh cùng tên của lượt chụp kia vào tmp/shots/<tên>-vs-<kia>/.
// `--q` nối thêm tham số URL vào mọi khung (`--q stick`: người mặc đồ vẽ lại thành người que). `--soft` vẽ bằng SwiftShader
// thay GPU — chậm, chỉ dùng khi máy không có GPU.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'tmp/shots');
const SIZE = { width: 1280, height: 720 };
const BASE = 'nohud&aa=ss2';
/** Bộ khung cố định: đủ góc nhìn, giờ trong ngày và chế độ vẽ để thấy một thay đổi của rig hay pipeline. */
const SHOTS = [
  ['dung-yen', 't=0'],
  ['trai-noi', 't=1.8'],
  ['gai-noi', 't=5.1'],
  ['chinh-dien', 't=1.8&az=0&el=0'],
  ['nghieng', 't=1.8&az=60&el=5'],
  ['sau-lung', 't=1.8&az=180&el=10'],
  ['tu-tren', 't=1.8&az=30&el=55&dist=16'],
  ['can-mat', 't=5.1&look=0.9,3.5,0&az=-10&el=4&dist=6'],
  ['chieu', 't=1.8&time=evening'],
  ['khong-net', 't=1.8&noink'],
  ['pixel', 't=1.8&pixel'],
  ['di', 'demo=walk&t=1.2'],
  ['di-nghieng', 'demo=walk&t=1.75&az=0&el=4&look=-0.4,1.8,0'],
  ['ngoi', 'demo=sit&t=0.9&az=60&el=12&look=1.2,1.4,0&dist=12'],
  ['ngoi-nghieng', 'demo=sit&t=1.3&az=0&el=6&look=1.3,1.6,0&dist=12'],
  ['mat', 'demo=faces&t=0.9&az=0&el=3&look=0,3.1,0&dist=12'],
  ['nhin', 'demo=look&t=1.2&az=0&el=4&look=0,3,0&dist=7'],
  ['cam', 'demo=hold&t=2&az=10&el=12&dist=19&look=0,1.8,0.5'],
  ['cam-khay', 'demo=hold&t=2&az=65&el=22&dist=6&look=-0.3,2.4,1.5'],
  ['cam-khay-gan', 'demo=hold&t=2&az=90&el=30&dist=4&look=-0.1,2.3,1.5'],
  ['cam-coc', 'demo=hold&t=2&az=-20&el=12&dist=3.5&look=-4.4,2.15,0.1'],
  ['cam-coc-nghieng', 'demo=hold&t=2&az=-90&el=5&dist=3.5&look=-4.4,2.15,0.1'],
  ['cam-giay', 'demo=hold&t=2&az=20&el=8&dist=6&look=4.3,2.2,-0.2'],
  ['cam-mu-truoc', 'demo=hold&t=2&az=0&el=5&dist=5&look=-4.3,3.25,-0.2'],
  ['cam-mu-nghieng', 'demo=hold&t=2&az=90&el=5&dist=5&look=-4.3,3.25,-0.2'],
  ['cam-mu-sau', 'demo=hold&t=2&az=180&el=10&dist=5&look=-4.3,3.25,-0.2'],
  ['cam-mu-tren', 'demo=hold&t=2&az=30&el=60&dist=5&look=-4.3,3.1,-0.2'],
  ['cam-kinh', 'demo=hold&t=2&az=-25&el=5&dist=6&look=4.3,3.4,-0.2'],
  ['cam-nen', 'demo=hold&t=0&az=0&el=20&dist=11&look=0.8,2,-3.3'],
  ['may-nha', 'demo=camera&t=0.4'],
  ['may-gan', 'demo=camera&t=1.6'],
  ['may-lia', 'demo=camera&t=2.6'],
  ['may-lui', 'demo=camera&t=3.7'],
  ['bong-nguoi', 'demo=light&t=1&az=25&el=22&look=-6.3,1.9,-0.6&dist=10'],
  ['phong-ngay', 'demo=light&t=1&az=15&el=10&look=0,2.8,0&dist=21'],
  ['phong-chieu', 'demo=light&t=1&az=15&el=10&look=0,2.8,0&dist=21&time=evening'],
  ['phong-toi-1830', 'demo=light&t=1&az=15&el=10&look=0,2.8,0&dist=21&time=dusk'],
  ['phong-dem-den-ban', 'demo=light&t=1&az=-35&el=14&look=5,1.6,-1.5&dist=9&time=night'],
  ['den-roi-bat', 'demo=light&t=0.6&az=15&el=10&look=0,2.8,0&dist=21&time=dim&spot'],
  ['phong-den-roi', 'demo=light&t=3&az=15&el=10&look=0,2.8,0&dist=21&time=dim&spot'],
  ['hoi-tuong', 'demo=light&t=1&az=15&el=10&look=0,2.8,0&dist=21&grade=flashback'],
  ['tua-bang', 't=1.8&grade=vhs'],
  ['kieu-1', 'demo=styles&az=0&el=4&look=-11.6,2.5,0&dist=12'],
  ['kieu-2', 'demo=styles&az=0&el=4&look=-2.9,2.5,0&dist=12'],
  ['kieu-3', 'demo=styles&az=0&el=4&look=5.1,2.8,0&dist=12.5'],
  ['kieu-4', 'demo=styles&az=0&el=4&look=12.3,2.5,0&dist=12'],
  ['kieu-nghieng', 'demo=styles&turn=110&az=0&el=6&look=5.8,3.4,0&dist=9'],
  ['kieu-sau', 'demo=styles&turn=200&az=0&el=8&look=9.4,3.2,0&dist=11'],
  ['mieng', 'demo=mouths&az=0&el=8&look=0,4.6,-1.5&dist=15'],
  ['hanh-dong', 'demo=acts&t=2&az=20&el=8&look=0,2.2,0&dist=17'],
  ['hanh-dong-nghieng', 'demo=acts&t=2&az=-25&el=14&look=0,2.2,0&dist=17'],
  ['chao', 'demo=acts&t=0.75&az=-20&el=5&look=-4.8,2.5,0&dist=7.5'],
  ['ban', 'demo=desk&t=2&az=40&el=12&look=0,1.8,0&dist=17'],
  ['ban-nghieng', 'demo=desk&t=2&az=-30&el=15&look=0,1.8,0&dist=17'],
  ['dau-than', 'demo=heads&t=2&az=10&el=4&look=0,2.6,0&dist=13'],
  ['ngang', 'demo=side&t=2&az=0&el=8&look=0,2.2,0&dist=15'],
  ['vo-ngay', 'demo=room&t=1&az=20&el=22&look=0,2,0&dist=30'],
  ['vo-1830', 'demo=room&t=1&az=20&el=22&look=0,2,0&dist=30&time=dusk'],
  ['vo-dem', 'demo=room&t=1&az=20&el=22&look=0,2,0&dist=30&time=night'],
  ['vo-goc-ngoai', 'demo=room&t=1&az=-50&el=30&look=0,1.5,0&dist=32'],
  ['vo-tren', 'demo=room&t=1&az=0&el=75&look=0,0,0&dist=34'],
  ['vo-cua-mo', 'demo=room&t=1.5&door=0.5&az=-70&el=3&look=10,2.8,3&dist=12'],
  ['hai-san-khau', 'demo=stages'],
  ['vo-ngoai-thap', 'demo=room&t=1&az=10&el=3&look=0,3.2,0&dist=28'],
  ['vo-cua-so', 'demo=room&t=1&az=70&el=4&look=-10,3.5,-0.5&dist=9'],
  ['vo-rem', 'demo=room&t=1&az=55&el=12&look=-8,2.5,-1&dist=16'],
  ['vo-tu-treo', 'demo=room&t=1&az=10&el=4&look=-4.5,2.6,-8&dist=15'],
  ['decal', 'demo=decal&t=6&az=12&el=14&dist=12&look=0,2.4,-1.8'],
  ['decal-man-hinh', 'demo=decal&t=6&az=18&el=4&dist=3&look=0,2.12,-3.03'],
  ['decal-giay-nho', 'demo=decal&t=6&az=10&el=6&dist=1.1&look=0.55,2.55,-3'],
  ['decal-dong-ho', 'demo=decal&t=2.4&az=10&el=5&dist=3&look=-3.3,4.7,-5.2'],
  ['decal-lich', 'demo=decal&t=3.25&az=-10&el=14&dist=2&look=1.18,1.75,-2.62'],
  ['decal-the-nguc', 'demo=decal&t=6&az=-25&el=4&dist=1.5&look=3.2,2.7,-1.1'],
  ['decal-to-bay', 'demo=decal&t=3.6&az=12&el=14&dist=12&look=0,2.4,-1.8'],
  ['decal-to-dap', 'demo=decal&t=4.55&az=-35&el=35&dist=3&look=-1,1.45,-2.55'],
  ['decal-toi', 'demo=decal&t=3.5&az=12&el=14&dist=12&look=0,2.4,-1.8&time=dim&spot'],
  ['decal-dem-man-hinh', 'demo=decal&t=6&az=18&el=4&dist=3&look=0,2.12,-3.03&time=night'],
  ['canh-sat', 'demo=police&t=1.8&az=0&el=22&dist=16&look=0.6,1.8,-4'],
  ['canh-sat-dung', 'demo=police&t=5&az=12&el=18&dist=12&look=0.6,2.2,-4.5'],
  ['canh-sat-bang-ten', 'demo=police&t=5&az=-20&el=45&dist=3&look=2.8,1.45,-1.6'],
  ['nguoi-canh', 'demo=human&t=2&az=10&el=12&dist=22&look=0,1.8,0'],
  ['nguoi-dung', 'demo=human-row&t=1&az=0&el=4&look=0,2.3,0&dist=17'],
  ['nguoi-34', 'demo=human-row&t=1&az=40&el=6&look=0,2.3,0&dist=17'],
  ['nguoi-nghieng', 'demo=human-row&t=1&az=90&el=5&look=0,2.3,0&dist=17'],
  ['nguoi-sau', 'demo=human-row&t=1&az=180&el=8&look=0,2.3,0&dist=17'],
  ['nguoi-vai', 'demo=human-row&t=1&az=0&el=4&look=-1.5,2.6,0&dist=6'],
  ['nguoi-vai-34', 'demo=human-row&t=1&az=35&el=12&look=-1.5,2.6,0&dist=6'],
  ['nguoi-chan', 'demo=human-row&t=1&az=30&el=10&look=-0.75,0.4,0&dist=5'],
  ['nguoi-hong', 'demo=human-row&t=1&az=0&el=4&look=-1.5,1.4,0&dist=6'],
  ['nguoi-mong', 'demo=human-row&t=1&az=145&el=8&look=-1.5,1.4,0&dist=6'],
  ['nguoi-mat', 'demo=human-faces&t=1&az=0&el=3&look=0,3.45,0&dist=10'],
  ['nguoi-mat-34', 'demo=human-faces&t=1&az=35&el=3&look=0,3.45,0&dist=10'],
  ['nguoi-mat-nghieng', 'demo=human-faces&t=1&az=75&el=3&look=0,3.45,0&dist=10'],
  ['nguoi-noi', 'demo=human&t=2&az=20&el=5&look=-3.3,2.6,0&dist=6.5'],
  ['nguoi-di', 'demo=human&t=1.2&az=-15&el=5&look=-1.3,1.8,-2&dist=7'],
  ['nguoi-ngoi', 'demo=human&t=2&az=70&el=8&look=-0.2,1.9,1.5&dist=5.5'],
  ['nguoi-ngoi-nghieng', 'demo=human&t=2&az=0&el=6&look=-0.2,1.6,1.5&dist=6'],
  ['nguoi-coc', 'demo=human&t=2&az=-20&el=8&look=3.3,2.3,0.4&dist=4.5'],
  ['nguoi-nu-di', 'demo=human&t=1.4&az=10&el=5&look=1.8,1.9,3.3&dist=7'],
  ['nguoi-ghe', 'demo=human-bench&t=1&az=25&el=6&look=0,1.5,0&dist=7'],
  ['nguoi-ghe-nghieng', 'demo=human-bench&t=1&az=70&el=5&look=0,1.4,0&dist=6'],
  ['nguoi-ghe-tren', 'demo=human-bench&t=1&az=10&el=35&look=0,1.3,0&dist=6'],
  ['nguoi-ghe-sau', 'demo=human-bench&t=1&az=160&el=10&look=0,1.4,0&dist=6'],
  ['co-cheo', 'demo=human-wrap&t=1&az=0&el=4&look=0,2.3,0&dist=13'],
  ['co-cheo-34', 'demo=human-wrap&t=1&az=40&el=6&look=0,2.3,0&dist=13'],
  ['co-cheo-nghieng', 'demo=human-wrap&t=1&az=90&el=5&look=0,2.3,0&dist=13'],
  ['co-cheo-sau', 'demo=human-wrap&t=1&az=180&el=8&look=0,2.3,0&dist=13'],
  ['co-cheo-34-sau', 'demo=human-wrap&t=1&az=140&el=8&look=0,2.3,0&dist=13'],
  ['co-cheo-gan', 'demo=human-wrap&t=1&az=0&el=4&look=-1.5,2.9,0&dist=6'],
  ['co-cheo-gan-34', 'demo=human-wrap&t=1&az=30&el=10&look=-1.5,2.9,0&dist=6'],
  ['co-cheo-gan-sau', 'demo=human-wrap&t=1&az=200&el=10&look=-1.5,2.4,0&dist=6'],
  ['co-cheo-chao', 'demo=human-wrap-act&t=1.2&az=-25&el=6&look=0.1,2,0&dist=15'],
  ['co-cheo-chao-nghieng', 'demo=human-wrap-act&t=1.2&az=-90&el=6&look=0.1,2,0&dist=15'],
  ['co-cheo-ngoi', 'demo=human-wrap-act&t=1.2&az=30&el=10&look=2.4,1.4,0&dist=6'],
  ['co-cheo-ngoi-nghieng', 'demo=human-wrap-act&t=1.2&az=90&el=6&look=2.4,1.4,0&dist=6'],
  ['co-cheo-di', 'demo=human-wrap-act&t=1.2&az=0&el=6&look=-1.5,1.9,3&dist=6.5'],
  ['co-cheo-di-truoc', 'demo=human-wrap-act&t=1.35&az=75&el=6&look=-0.6,1.9,3&dist=7'],
  ['co-cheo-ngoi-gan', 'demo=human-wrap-act&t=1.2&az=0&el=8&look=2.4,1.5,0&dist=4'],
  ['co-cheo-nghieng-nu', 'demo=human-wrap&t=1&az=-90&el=5&look=-2.25,2.3,0&dist=5'],
  ['nguoi-hanh-dong', 'demo=acts&human&t=2&az=20&el=8&look=0,2.2,0&dist=17'],
  ['nguoi-ngang', 'demo=side&human&t=2&az=0&el=8&look=0,2.2,0&dist=15'],
  ['nguoi-ban', 'demo=desk&human&t=2&az=40&el=12&look=0,1.8,0&dist=17'],
  ['nguoi-ban-nghieng', 'demo=desk&human&t=2&az=-30&el=15&look=0,1.8,0&dist=17'],
  ['nguoi-cam', 'demo=hold&human&t=2&az=10&el=12&dist=19&look=0,1.8,0.5'],
  ['nguoi-cam-khay', 'demo=hold&human&t=2&az=65&el=22&dist=6&look=-0.3,2.4,1.5'],
  ['nguoi-cam-coc', 'demo=hold&human&t=2&az=-20&el=12&dist=3.5&look=-4.4,2.15,0.1'],
  ['kieu-nguoi-1', 'demo=styles&human&az=0&el=4&look=-11.6,2.5,0&dist=12'],
  ['kieu-nguoi-2', 'demo=styles&human&az=0&el=4&look=-2.9,2.5,0&dist=12'],
  ['kieu-nguoi-3', 'demo=styles&human&az=0&el=4&look=5.1,2.8,0&dist=12.5'],
  ['kieu-nguoi-4', 'demo=styles&human&az=0&el=4&look=12.3,2.5,0&dist=12'],
  ['kieu-nguoi-nghieng', 'demo=styles&human&turn=100&az=0&el=6&look=-5,3.2,0&dist=12'],
  ['kieu-nguoi-nghieng-2', 'demo=styles&human&turn=100&az=0&el=6&look=6,3.2,0&dist=12'],
  ['kieu-nguoi-sau', 'demo=styles&human&turn=200&az=0&el=8&look=-5,3.2,0&dist=12'],
  ['kieu-nguoi-sau-2', 'demo=styles&human&turn=200&az=0&el=8&look=6,3.2,0&dist=12'],
  ['dau-truoc', 'demo=headgear&az=0&el=3&look=0,3.45,0&dist=13.5'],
  ['dau-34', 'demo=headgear&turn=40&az=0&el=3&look=0,3.45,0&dist=13.5'],
  ['dau-nghieng', 'demo=headgear&turn=90&az=0&el=3&look=0,3.45,0&dist=13.5'],
  ['dau-sau', 'demo=headgear&turn=180&az=0&el=8&look=0,3.45,0&dist=13.5'],
  ['dau-tren', 'demo=headgear&turn=30&az=0&el=50&look=0,3.3,0&dist=13.5'],
  ['dau-cui', 'demo=headgear&turn=35&bow=40&az=0&el=8&look=0,3.1,0&dist=13.5'],
  ['dau-tram', 'demo=headgear&turn=200&az=0&el=10&look=-2.8,3.85,0&dist=4.6'],
  ['dau-tram-34', 'demo=headgear&turn=130&az=0&el=6&look=-2.8,3.85,0&dist=4.6'],
  ['dau-bui-to', 'demo=headgear&turn=150&az=0&el=4&look=-1.4,3.55,0&dist=4.6'],
  ['dau-vong', 'demo=headgear&turn=25&az=0&el=6&look=0,3.9,0&dist=4.6'],
  ['dau-vong-nghieng', 'demo=headgear&turn=90&az=0&el=6&look=0,3.9,0&dist=4.6'],
  ['dau-hoi-m', 'demo=headgear&turn=20&az=0&el=12&look=1.4,3.85,0&dist=4.6'],
  ['dau-mu', 'demo=headgear&turn=30&az=0&el=6&look=2.8,3.75,0&dist=4.6'],
  ['dau-mu-sau', 'demo=headgear&turn=160&az=0&el=10&look=2.8,3.65,0&dist=4.6'],
  ['dau-mai-bac', 'demo=headgear&turn=60&az=0&el=6&look=4.2,3.75,0&dist=4.6'],
  ['vat-dung', 'demo=hem&t=1&az=0&el=4&look=0,1.9,0&dist=14'],
  ['vat-34', 'demo=hem&t=1&turn=40&az=0&el=6&look=0,1.9,0&dist=14'],
  ['vat-nghieng', 'demo=hem&t=1&turn=90&az=0&el=5&look=0,1.9,0&dist=14'],
  ['vat-sau', 'demo=hem&t=1&turn=180&az=0&el=8&look=0,1.9,0&dist=14'],
  ['vat-gan', 'demo=hem&t=1&turn=15&az=0&el=5&look=-1.5,1.5,0&dist=7'],
  ['vat-di-1', 'demo=hem&act=walk&t=1.0&turn=90&az=0&el=5&look=0,1.9,0&dist=14'],
  ['vat-di-2', 'demo=hem&act=walk&t=1.25&turn=90&az=0&el=5&look=0,1.9,0&dist=14'],
  ['vat-di-3', 'demo=hem&act=walk&t=1.5&turn=90&az=0&el=5&look=0,1.9,0&dist=14'],
  ['vat-di-4', 'demo=hem&act=walk&t=1.75&turn=90&az=0&el=5&look=0,1.9,0&dist=14'],
  ['vat-di-truoc', 'demo=hem&act=walk&t=1.25&turn=25&az=0&el=5&look=0,1.9,0&dist=14'],
  ['vat-cui-30', 'demo=hem&act=bow30&t=1&turn=75&az=0&el=5&look=0,1.9,0&dist=14'],
  ['vat-cui-45', 'demo=hem&act=bow45&t=1&turn=75&az=0&el=5&look=0,1.9,0&dist=14'],
  ['vat-cui-45-truoc', 'demo=hem&act=bow45&t=1&turn=20&az=0&el=8&look=0,1.9,0&dist=14'],
  ['vat-cui-45-sau', 'demo=hem&act=bow45&t=1&turn=200&az=0&el=8&look=0,1.9,0&dist=14'],
  ['vat-ngoi', 'demo=hem&act=sit&t=1&turn=55&az=0&el=8&look=0,1.6,0&dist=14'],
  ['vat-ngoi-truoc', 'demo=hem&act=sit&t=1&turn=10&az=0&el=8&look=0,1.6,0&dist=14'],
  ['vat-ngoi-gan', 'demo=hem&act=sit&t=1&turn=35&az=0&el=20&look=0.75,1.3,0&dist=5'],
  ['vat-seiza', 'demo=hem&act=seiza&t=1&turn=55&az=0&el=10&look=0,1.2,0&dist=14'],
  ['vat-seiza-sau', 'demo=hem&act=seiza&t=1&turn=150&az=0&el=10&look=0,1.2,0&dist=14'],
  ['ban-tay', 'demo=hands&t=1.4&az=-20&el=6&look=0,2.6,0&dist=9'],
  ['ban-tay-gan-1', 'demo=hands&t=1.4&az=-35&el=8&look=-1.2,2.7,0.4&dist=4.5'],
  ['ban-tay-gan-2', 'demo=hands&t=1.4&az=-35&el=8&look=1.7,2.7,0.4&dist=4.5'],
  ['tay-xoe', 'demo=hands&t=1.4&az=-35&el=10&look=-2.03,2.63,1.1&dist=1.1'],
  ['tay-cam', 'demo=hands&t=1.4&az=-35&el=10&look=-0.59,2.63,1.1&dist=1.1'],
  ['tay-chi', 'demo=hands&t=1.4&az=-35&el=10&look=0.85,2.63,1.1&dist=1.1'],
  ['tay-dam', 'demo=hands&t=1.4&az=-35&el=10&look=2.29,2.63,1.1&dist=1.1'],
  ['tay-dam-truoc', 'demo=hands&t=1.4&az=40&el=15&look=2.29,2.63,1.1&dist=1.1'],
  ['tay-cam-truoc', 'demo=hands&t=1.4&az=40&el=15&look=-0.59,2.63,1.1&dist=1.1'],
  ['cu-chi', 'demo=gestures&t=1.4&az=20&el=8&look=0,2.4,0&dist=14'],
  ['vay-tay', 'demo=gestures&t=1.25&az=-15&el=6&look=-4,3.2,0&dist=5'],
  ['ngua-tay', 'demo=gestures&t=1.4&az=-25&el=20&look=-1.2,2.5,0.4&dist=5'],
  ['go-phim-up-tay', 'demo=gestures&t=1.4&az=-40&el=30&look=1.6,1.6,0.2&dist=4'],
  ['chi-tay', 'demo=gestures&t=1.4&az=-30&el=8&look=4,2.9,0.6&dist=4.5'],
];

const { values: o } = parseArgs({ options: { out: { type: 'string' }, vs: { type: 'string' }, only: { type: 'string' }, soft: { type: 'boolean' }, q: { type: 'string' } } });
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const name = o.out ?? (() => {
  try {
    return git('rev-parse', '--short', 'HEAD') + (git('status', '--porcelain') ? '-dirty' : '');
  } catch {
    return 'chua-commit';
  }
})();
const only = o.only?.split(',');
const shots = SHOTS.filter(([n]) => !only || only.includes(n));
const dir = join(OUT, name);
mkdirSync(dir, { recursive: true });

const server = await createServer({ root: join(ROOT, 'apps/viewer'), logLevel: 'error', server: { port: 0 } });
await server.listen();
const url = server.resolvedUrls.local[0];
const chrome = process.env.CHROME ?? ['/usr/bin/chromium', '/usr/bin/google-chrome-stable'].find(existsSync);
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: o.soft ? ['--enable-unsafe-swiftshader'] : ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ ...SIZE, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('lỗi trang:', e.message));
  for (const [n, q] of shots) {
    await page.goto(`${url}?${BASE}&${q}${o.q ? `&${o.q}` : ''}`, { waitUntil: 'load' });
    // vài khung cho OrbitControls về chỗ
    await page.waitForFunction(() => window.__frames >= 4, { timeout: 60000 });
    const file = join(dir, `${n}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
} finally {
  await browser.close();
  await server.close();
}

const files = shots.map(([n]) => join(dir, `${n}.png`));
const sheet = join(OUT, `${name}.png`);
execFileSync('magick', ['montage', ...shots.flatMap(([n], i) => ['-label', n, files[i]]), '-tile', '2x', '-geometry', '640x360+6+6', '-pointsize', '18', sheet]);
console.log(sheet);

if (o.vs) {
  const other = join(OUT, o.vs);
  const pair = join(OUT, `${name}-vs-${o.vs}`);
  mkdirSync(pair, { recursive: true });
  for (const [n] of shots) {
    const a = join(other, `${n}.png`), b = join(dir, `${n}.png`);
    if (!existsSync(a)) {
      console.warn(`${o.vs} không có ${n}.png`);
      continue;
    }
    execFileSync('magick', ['montage', '-label', o.vs, a, '-label', name, b, '-tile', '2x1', '-geometry', '+6+6', '-pointsize', '22', join(pair, `${n}.png`)]);
  }
  console.log(pair);
}
