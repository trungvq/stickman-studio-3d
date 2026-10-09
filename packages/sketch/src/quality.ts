import { createContext } from "react";

/**
 * Độ mịn của hình dựng khối. `draft` làm tròn góc đầu để tóc trúng cache khi phát thời gian thực;
 * `final` chiếu đúng góc từng khung, chỉ cho bản render để đăng — xem docs/02-trang-phuc.md
 */
export type RigQuality = "draft" | "final";

export const RigQualityContext = createContext<RigQuality>("draft");
