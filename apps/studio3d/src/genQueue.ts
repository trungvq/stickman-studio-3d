// Hàng chạy bộ sinh của trang soi: một lượt một lúc; đầu vào đổi thì lượt đang chạy thành cũ ngay (không đợi hết thời gian
// chờ gõ) và chạy lại sau khi ngừng gõ. README.md#bộ-sinh

export interface GenTimers {
  set(f: () => void, ms: number): number;
  clear(id: number): void;
}

export class GenQueue {
  /** Tăng mỗi lần đầu vào đổi: lượt mang mã cũ là lượt cũ */
  private seq = 0;
  private timer = 0;
  private busy = false;
  private again = false;

  /** `run(stale)`: một lượt; `stale()` đúng thì đầu vào đã đổi, lượt không được nhận kết quả của nó */
  constructor(
    private run: (stale: () => boolean) => Promise<void>,
    private timers: GenTimers,
  ) {}

  /** Đầu vào đổi: lượt đang chạy thành cũ, chạy lại sau `delay` ms */
  changed(delay: number) {
    this.seq++;
    this.timers.clear(this.timer);
    this.timer = this.timers.set(() => void this.go(), delay);
  }

  /** Chạy với đầu vào hiện tại; đang có lượt thì chạy tiếp sau lượt ấy */
  async go(): Promise<void> {
    if (this.busy) {
      this.again = true;
      return;
    }
    this.busy = true;
    this.again = false;
    const my = this.seq;
    try {
      await this.run(() => my !== this.seq);
    } finally {
      this.busy = false;
      if (this.again) void this.go();
    }
  }
}
