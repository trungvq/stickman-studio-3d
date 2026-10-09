import { useId } from "react";
import type { PartBox, PartDef } from "./Parts";

function Basket({ w, h }: PartBox) {
  const clipId = `basket-${useId()}`;
  return (
    <svg preserveAspectRatio="none" width={w} height={h} viewBox="33 93 294 169.5">
      <g strokeLinecap="round" strokeLinejoin="round">
        <g stroke="#70573d" strokeWidth="4">
          <ellipse cx="180" cy="139" rx="143" ry="42" fill="#8d6c43" strokeWidth="8" />
          <ellipse cx="180" cy="139" rx="129" ry="30" fill="#a6804d" strokeWidth="3" />
        </g>
        <g stroke="#70573d" strokeWidth="4">
          <path d="M37 139A143 42 0 0 0 323 139L289 234Q180 284 71 234Z" fill="#c7a16a" />
          <svg x="0" y="0" width="360" height="290" viewBox="0 0 360 290">
            <defs>
              <clipPath id={clipId}>
                <path d="M37 139A143 42 0 0 0 323 139L289 234Q180 284 71 234Z" />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              <path
                d="M49 174Q180 227 311 174M58 200Q180 253 301 200M68 224Q180 274 291 224"
                fill="none"
                stroke="#987446"
                strokeWidth="3"
              />
              <path
                d="m70 156 28 88m12-75 16 84m23-77 5 82m29-80-1 82m31-85-7 82m39-90-17 82m51-96-29 86"
                fill="none"
                stroke="#987446"
                strokeWidth="3"
              />
            </g>
          </svg>
          <path d="M37 139A143 42 0 0 0 323 139" fill="none" stroke="#70573d" strokeWidth="8" />
          <path d="M37 139A143 42 0 0 0 323 139" fill="none" stroke="#dfbc80" strokeWidth="3" />
          <path d="M73 235Q180 282 287 235" fill="none" stroke="#70573d" strokeWidth="7" />
        </g>
      </g>
    </svg>
  );
}

export const PROP_ART: Record<string, PartDef> = {
  "gold-bar": {
    label: "Thỏi vàng",
    sockets: ["prop"],
    aspect: 384 / 206,
    draw: ({ w, h }) => (
      <svg preserveAspectRatio="none" width={w} height={h} viewBox="25 25 192 103">
        <g strokeLinecap="round" strokeLinejoin="round">
          <g>
            <g stroke="#8d7139" strokeWidth="4">
              <path d="M27 81 61 37 186 27 215 66 193 112 47 126Z" fill="#e7bd54" />
              <path d="M27 81 173 70 215 66 193 112 47 126Z" fill="#d3a442" />
              <path d="m173 70 13-43 29 39-22 46-20-42Z" fill="#bd9039" />
              <path d="M27 81 61 37 186 27 173 70Z" fill="#f5d879" />
              <path d="m62 49 91-7" fill="none" stroke="#fff0b4" strokeWidth="5" />
            </g>
          </g>
        </g>
      </svg>
    ),
  },
  "silver-bar": {
    label: "Thỏi bạc",
    sockets: ["prop"],
    aspect: 384 / 206,
    draw: ({ w, h }) => (
      <svg preserveAspectRatio="none" width={w} height={h} viewBox="25 25 192 103">
        <g strokeLinecap="round" strokeLinejoin="round">
          <g>
            <g stroke="#667579" strokeWidth="4">
              <path d="M27 81 61 37 186 27 215 66 193 112 47 126Z" fill="#bfcaca" />
              <path d="M27 81 173 70 215 66 193 112 47 126Z" fill="#aebdc0" />
              <path d="m173 70 13-43 29 39-22 46-20-42Z" fill="#8c9da4" />
              <path d="M27 81 61 37 186 27 173 70Z" fill="#dde5df" />
              <path d="m62 49 91-7" fill="none" stroke="#f7f8ee" strokeWidth="5" />
            </g>
          </g>
        </g>
      </svg>
    ),
  },
  "gold-nugget": {
    label: "Cục vàng",
    sockets: ["prop"],
    aspect: 389 / 295,
    draw: ({ w, h }) => (
      <svg
        preserveAspectRatio="none"
        width={w}
        height={h}
        viewBox="16.25 29.166666667 162.083333333 122.916666667"
      >
        <g strokeLinecap="round" strokeLinejoin="round">
          <g>
            <g stroke="#8d7139" strokeWidth="4">
              <path
                d="M24 114Q13 103 24 88L35 82Q27 58 44 49L64 53Q71 27 90 32L108 47Q132 34 142 53L140 71Q170 68 176 90L166 106Q180 126 159 137L136 133Q119 153 100 143L82 150 61 137Q36 144 30 126Z"
                fill="#e7bd54"
              />
              <path
                d="M30 126Q48 132 61 121L83 131 103 124Q124 139 137 119L157 120 166 106Q180 126 159 137L136 133Q119 153 100 143L82 150 61 137Q36 144 30 126Z"
                fill="#c79a3c"
                stroke="none"
              />
              <path
                d="m44 66 17-1 7 12m30-24 13 13-4 13m29 11 13 2 4 11m-72-1-10 9"
                fill="none"
                stroke="#bc913e"
                strokeWidth="3"
              />
              <path
                d="M40 102q-4-10 3-13m34-30q1-13 12-11m30 45 7-5"
                fill="none"
                stroke="#f8dfa0"
                strokeWidth="5"
              />
            </g>
          </g>
        </g>
      </svg>
    ),
  },
  "silver-nugget": {
    label: "Cục bạc",
    sockets: ["prop"],
    aspect: 384 / 281,
    draw: ({ w, h }) => (
      <svg preserveAspectRatio="none" width={w} height={h} viewBox="20 40 160 117.083333333">
        <g strokeLinecap="round" strokeLinejoin="round">
          <g>
            <g stroke="#667579" strokeWidth="4">
              <path
                d="m22 117 15-28 25-5 4-26 35-16 23 12 19-5 22 29-8 24 21 14-16 28-35-2-18 13-33-15-34 4Z"
                fill="#bfcaca"
              />
              <path
                d="m22 117 39-9 24 13 34-13 38-6 21 14-16 28-35-2-18 13-33-15-34 4Z"
                fill="#8c9da4"
                stroke="none"
              />
              <path
                d="m37 89 24 19 5-50 19 19 16-35m-16 35 34 31 24-59m-24 59 8 34m-42-21-9 19"
                fill="none"
                stroke="#8c9da4"
                strokeWidth="3"
              />
              <path
                d="m77 62 20-9m44 23 8 12M44 100l9 8"
                fill="none"
                stroke="#f7f8ee"
                strokeWidth="5"
              />
            </g>
          </g>
        </g>
      </svg>
    ),
  },
  "gold-coins": {
    label: "Chồng tiền vàng",
    sockets: ["prop"],
    aspect: 368 / 175,
    draw: ({ w, h }) => (
      <svg
        preserveAspectRatio="none"
        width={w}
        height={h}
        viewBox="30.708333333 78.833333333 168.666666667 80.208333333"
      >
        <g strokeLinecap="round" strokeLinejoin="round">
          <g stroke="#8d7139" strokeWidth="4">
            <path d="M33 97v39c0 17 104 17 104 0V97" fill="#d3a442" />
            <path d="M33 110c0 17 104 17 104 0M33 123c0 17 104 17 104 0" fill="none" />
            <ellipse cx="85" cy="97" rx="52" ry="16" fill="#f5d879" />
            <path d="m78 92 18 0 0 9-18 0Z" fill="#b38e46" strokeWidth="2" />
            <ellipse
              cx="159"
              cy="137"
              rx="39"
              ry="18"
              fill="#e7bd54"
              transform="rotate(-13 159 137)"
            />
            <path d="m150 134 16-3 2 10-16 3Z" fill="#b38e46" strokeWidth="2" />
          </g>
        </g>
      </svg>
    ),
  },
  diamond: {
    label: "Kim cương",
    sockets: ["prop"],
    aspect: 372 / 318,
    draw: ({ w, h }) => (
      <svg
        preserveAspectRatio="none"
        width={w}
        height={h}
        viewBox="25.666666667 25.666666667 170.5 145.75"
      >
        <g strokeLinecap="round" strokeLinejoin="round">
          <g>
            <g stroke="#587f8b" strokeWidth="4">
              <path d="M28 67 63 28H155L194 67 110 169Z" fill="#c8e5e7" />
              <path d="M28 67h166L110 169Z" fill="#9ecbd5" />
              <path d="m76 67 34 102 36-102Z" fill="#e6f4eb" />
              <path d="m63 28 13 39 34-39 36 39 9-39M28 67h166M76 67l34 102 36-102" fill="none" />
              <path d="m48 57 18-19m93 7 12 12" fill="none" stroke="#f8fcf2" strokeWidth="5" />
            </g>
          </g>
        </g>
      </svg>
    ),
  },
  ruby: {
    label: "Hồng ngọc",
    sockets: ["prop"],
    aspect: 389 / 346,
    draw: ({ w, h }) => (
      <svg
        preserveAspectRatio="none"
        width={w}
        height={h}
        viewBox="20 22.916666667 162.083333333 144.166666667"
      >
        <g strokeLinecap="round" strokeLinejoin="round">
          <g>
            <g stroke="#874c53" strokeWidth="4">
              <path
                d="M100 25 137 33 170 62 180 104 160 142 123 165 78 159 38 130 22 92 43 52Z"
                fill="#be6672"
              />
              <path
                d="m100 25-15 38-42-11m42 11 48 3 4-33m-4 33 16 44 31-6m-31 6-29 27 3 28m-3-28-51-8 9 30m-9-30-18-36-29-1m29 1 34-30"
                fill="none"
              />
              <path d="m85 63 48 3 16 44-29 27-51-8-18-36Z" fill="#df9292" />
              <path d="m69 83-7 12 8 17" fill="none" stroke="#f9ceba" strokeWidth="5" />
            </g>
          </g>
        </g>
      </svg>
    ),
  },
  emerald: {
    label: "Ngọc lục bảo",
    sockets: ["prop"],
    aspect: 327 / 413,
    draw: ({ w, h }) => (
      <svg
        preserveAspectRatio="none"
        width={w}
        height={h}
        viewBox="30.833333333 20 136.25 172.083333333"
      >
        <g strokeLinecap="round" strokeLinejoin="round">
          <g>
            <g stroke="#476d5c" strokeWidth="4">
              <path d="M59 22h83l23 26v119l-24 23H57l-24-26V48Z" fill="#77a382" />
              <path d="M70 46h60l14 17v90l-16 14H70l-16-17V63Z" fill="#abd1a5" />
              <path
                d="m59 22 11 24m72-24-12 24m35 2-21 15m21 104-21-14m-3 37-13-23m-71 23 13-23m-37-3 21-14M33 48l21 15"
                fill="none"
              />
              <path d="M68 72v55" fill="none" stroke="#e1edc8" strokeWidth="5" />
            </g>
          </g>
        </g>
      </svg>
    ),
  },
  sapphire: {
    label: "Lam ngọc",
    sockets: ["prop"],
    aspect: 380 / 421,
    draw: ({ w, h }) => (
      <svg
        preserveAspectRatio="none"
        width={w}
        height={h}
        viewBox="21.666666667 16.666666667 158.333333333 175.416666667"
      >
        <g strokeLinecap="round" strokeLinejoin="round">
          <g>
            <g stroke="#536781" strokeWidth="4">
              <path d="m107 19 48 64 23 45-14 34-37 28-43-3-43-25-17-35 30-49Z" fill="#7c98ba" />
              <path
                d="m107 19-20 74-33-15m33 15 48-2 20-8m-20 8 15 46 28-9m-28 9-42 27 19 26m-19-26-43-28-24 26m24-26 22-43m-22 43-41-9"
                fill="none"
              />
              <path d="m87 93 48-2 15 46-42 27-43-28Z" fill="#b0c4dd" />
              <path d="m97 62 5-19m-21 71-4 12" fill="none" stroke="#e4eced" strokeWidth="5" />
            </g>
          </g>
        </g>
      </svg>
    ),
  },
  "treasure-crown": {
    label: "Vương miện vàng",
    sockets: ["prop"],
    aspect: 380 / 298,
    draw: ({ w, h }) => (
      <svg preserveAspectRatio="none" width={w} height={h} viewBox="30.625 23.75 237.5 186.25">
        <g strokeLinecap="round" strokeLinejoin="round">
          <g>
            <g stroke="#8d7139" strokeWidth="4">
              <path
                d="M44 76 94 116 151 40 202 113 255 73 232 193Q144 222 62 193Z"
                fill="#e7bd54"
              />
              <path
                d="m44 76 29 96 20-56m109-3 20 54 33-94M151 40v108"
                fill="none"
                stroke="#bd9039"
                strokeWidth="5"
              />
              <path d="M60 168Q150 192 236 166L232 193Q144 222 62 193Z" fill="#f5d879" />
              <path d="M69 190Q150 213 225 190" fill="none" stroke="#bd9039" strokeWidth="3" />
              <path d="m150 106 17 23-17 25-17-25Z" fill="#be6672" stroke="#874c53" />
              <ellipse cx="92" cy="181" rx="7" ry="9" fill="#77a382" />
              <ellipse cx="150" cy="188" rx="9" ry="10" fill="#be6672" />
              <ellipse cx="207" cy="180" rx="7" ry="9" fill="#7c98ba" />
              <circle cx="43" cy="73" r="10" fill="#f5d879" />
              <circle cx="151" cy="37" r="11" fill="#f5d879" />
              <circle cx="256" cy="71" r="10" fill="#f5d879" />
            </g>
          </g>
        </g>
      </svg>
    ),
  },
  "pearl-necklace": {
    label: "Chuỗi ngọc trai",
    sockets: ["prop"],
    aspect: 356 / 368,
    draw: ({ w, h }) => (
      <svg
        preserveAspectRatio="none"
        width={w}
        height={h}
        viewBox="37.458333333 33.833333333 215.083333333 222.333333333"
      >
        <g strokeLinecap="round" strokeLinejoin="round">
          <g>
            <ellipse
              cx="145"
              cy="119"
              rx="95"
              ry="73"
              fill="none"
              stroke="#9c956f"
              strokeWidth="4"
            />
          </g>
          <g stroke="#8b8770" strokeWidth="3">
            <g>
              <circle cx="240.00" cy="119.00" r="11" fill="#f0ead5" />
              <path d="M235.00 117.00q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="236.15" cy="139.57" r="11" fill="#f0ead5" />
              <path d="M231.15 137.57q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="224.92" cy="158.47" r="11" fill="#f0ead5" />
              <path d="M219.92 156.47q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="207.21" cy="174.17" r="11" fill="#f0ead5" />
              <path d="M202.21 172.17q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="184.46" cy="185.40" r="11" fill="#f0ead5" />
              <path d="M179.46 183.40q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="158.52" cy="191.26" r="11" fill="#f0ead5" />
              <path d="M153.52 189.26q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="131.48" cy="191.26" r="11" fill="#f0ead5" />
              <path d="M126.48 189.26q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="105.54" cy="185.40" r="11" fill="#f0ead5" />
              <path d="M100.54 183.40q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="82.79" cy="174.17" r="11" fill="#f0ead5" />
              <path d="M77.79 172.17q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="65.08" cy="158.47" r="11" fill="#f0ead5" />
              <path d="M60.08 156.47q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="53.85" cy="139.57" r="11" fill="#f0ead5" />
              <path d="M48.85 137.57q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="50.00" cy="119.00" r="11" fill="#f0ead5" />
              <path d="M45.00 117.00q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="53.85" cy="98.43" r="11" fill="#f0ead5" />
              <path d="M48.85 96.43q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="65.08" cy="79.53" r="11" fill="#f0ead5" />
              <path d="M60.08 77.53q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="82.79" cy="63.83" r="11" fill="#f0ead5" />
              <path d="M77.79 61.83q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="105.54" cy="52.60" r="11" fill="#f0ead5" />
              <path d="M100.54 50.60q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="131.48" cy="46.74" r="11" fill="#f0ead5" />
              <path d="M126.48 44.74q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="158.52" cy="46.74" r="11" fill="#f0ead5" />
              <path d="M153.52 44.74q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="184.46" cy="52.60" r="11" fill="#f0ead5" />
              <path d="M179.46 50.60q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="207.21" cy="63.83" r="11" fill="#f0ead5" />
              <path d="M202.21 61.83q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="224.92" cy="79.53" r="11" fill="#f0ead5" />
              <path d="M219.92 77.53q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
            <g>
              <circle cx="236.15" cy="98.43" r="11" fill="#f0ead5" />
              <path d="M231.15 96.43q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
            </g>
          </g>
          <g stroke="#8d7139" strokeWidth="4">
            <circle cx="145" cy="201" r="7" fill="#f5d879" />
            <path d="m145 208 17 23-17 23-17-23Z" fill="#e7bd54" />
            <path d="m145 216 10 15-10 15-10-15Z" fill="#be6672" stroke="#874c53" strokeWidth="2" />
          </g>
        </g>
      </svg>
    ),
  },
  "treasure-pile": {
    label: "Đống châu báu",
    sockets: ["prop"],
    aspect: 815 / 535,
    draw: ({ w, h }) => (
      <svg
        preserveAspectRatio="none"
        width={w}
        height={h}
        viewBox="58.333333333 29.166666667 679.166666667 445.833333333"
      >
        <g strokeLinecap="round" strokeLinejoin="round">
          <g>
            <path
              d="M61 344 132 296 160 246 237 230 281 188 373 201 421 178 483 223 551 210 609 265 684 286 735 346 691 414 562 439 334 449 116 415Z"
              fill="#d3a442"
              stroke="#8d7139"
              strokeWidth="5"
            />
          </g>
          <g transform="translate(70 255) scale(1.0) rotate(-8)">
            <g stroke="#8d7139" strokeWidth="4">
              <path d="M33 97v39c0 17 104 17 104 0V97" fill="#d3a442" />
              <path d="M33 110c0 17 104 17 104 0M33 123c0 17 104 17 104 0" fill="none" />
              <ellipse cx="85" cy="97" rx="52" ry="16" fill="#f5d879" />
              <path d="m78 92 18 0 0 9-18 0Z" fill="#b38e46" strokeWidth="2" />
              <ellipse
                cx="159"
                cy="137"
                rx="39"
                ry="18"
                fill="#e7bd54"
                transform="rotate(-13 159 137)"
              />
              <path d="m150 134 16-3 2 10-16 3Z" fill="#b38e46" strokeWidth="2" />
            </g>
          </g>
          <g transform="translate(165 184) scale(0.88) rotate(-12)">
            <g>
              <g stroke="#8d7139" strokeWidth="4">
                <path
                  d="M24 114Q13 103 24 88L35 82Q27 58 44 49L64 53Q71 27 90 32L108 47Q132 34 142 53L140 71Q170 68 176 90L166 106Q180 126 159 137L136 133Q119 153 100 143L82 150 61 137Q36 144 30 126Z"
                  fill="#e7bd54"
                />
                <path
                  d="M30 126Q48 132 61 121L83 131 103 124Q124 139 137 119L157 120 166 106Q180 126 159 137L136 133Q119 153 100 143L82 150 61 137Q36 144 30 126Z"
                  fill="#c79a3c"
                  stroke="none"
                />
                <path
                  d="m44 66 17-1 7 12m30-24 13 13-4 13m29 11 13 2 4 11m-72-1-10 9"
                  fill="none"
                  stroke="#bc913e"
                  strokeWidth="3"
                />
                <path
                  d="M40 102q-4-10 3-13m34-30q1-13 12-11m30 45 7-5"
                  fill="none"
                  stroke="#f8dfa0"
                  strokeWidth="5"
                />
              </g>
            </g>
          </g>
          <g transform="translate(440 201) scale(0.9) rotate(8)">
            <g>
              <g stroke="#667579" strokeWidth="4">
                <path d="M27 81 61 37 186 27 215 66 193 112 47 126Z" fill="#bfcaca" />
                <path d="M27 81 173 70 215 66 193 112 47 126Z" fill="#aebdc0" />
                <path d="m173 70 13-43 29 39-22 46-20-42Z" fill="#8c9da4" />
                <path d="M27 81 61 37 186 27 173 70Z" fill="#dde5df" />
                <path d="m62 49 91-7" fill="none" stroke="#f7f8ee" strokeWidth="5" />
              </g>
            </g>
          </g>
          <g transform="translate(281 178) scale(1) rotate(-6)">
            <g>
              <g stroke="#8d7139" strokeWidth="4">
                <path d="M27 81 61 37 186 27 215 66 193 112 47 126Z" fill="#e7bd54" />
                <path d="M27 81 173 70 215 66 193 112 47 126Z" fill="#d3a442" />
                <path d="m173 70 13-43 29 39-22 46-20-42Z" fill="#bd9039" />
                <path d="M27 81 61 37 186 27 173 70Z" fill="#f5d879" />
                <path d="m62 49 91-7" fill="none" stroke="#fff0b4" strokeWidth="5" />
              </g>
            </g>
          </g>
          <g transform="translate(283 18) scale(1.08) rotate(-5)">
            <g>
              <g stroke="#8d7139" strokeWidth="4">
                <path
                  d="M44 76 94 116 151 40 202 113 255 73 232 193Q144 222 62 193Z"
                  fill="#e7bd54"
                />
                <path
                  d="m44 76 29 96 20-56m109-3 20 54 33-94M151 40v108"
                  fill="none"
                  stroke="#bd9039"
                  strokeWidth="5"
                />
                <path d="M60 168Q150 192 236 166L232 193Q144 222 62 193Z" fill="#f5d879" />
                <path d="M69 190Q150 213 225 190" fill="none" stroke="#bd9039" strokeWidth="3" />
                <path d="m150 106 17 23-17 25-17-25Z" fill="#be6672" stroke="#874c53" />
                <ellipse cx="92" cy="181" rx="7" ry="9" fill="#77a382" />
                <ellipse cx="150" cy="188" rx="9" ry="10" fill="#be6672" />
                <ellipse cx="207" cy="180" rx="7" ry="9" fill="#7c98ba" />
                <circle cx="43" cy="73" r="10" fill="#f5d879" />
                <circle cx="151" cy="37" r="11" fill="#f5d879" />
                <circle cx="256" cy="71" r="10" fill="#f5d879" />
              </g>
            </g>
          </g>
          <g transform="translate(488 291) scale(0.95) rotate(9)">
            <g>
              <g stroke="#8d7139" strokeWidth="4">
                <path d="M27 81 61 37 186 27 215 66 193 112 47 126Z" fill="#e7bd54" />
                <path d="M27 81 173 70 215 66 193 112 47 126Z" fill="#d3a442" />
                <path d="m173 70 13-43 29 39-22 46-20-42Z" fill="#bd9039" />
                <path d="M27 81 61 37 186 27 173 70Z" fill="#f5d879" />
                <path d="m62 49 91-7" fill="none" stroke="#fff0b4" strokeWidth="5" />
              </g>
            </g>
          </g>
          <g transform="translate(107 316) scale(0.9) rotate(-8)">
            <g>
              <g stroke="#667579" strokeWidth="4">
                <path d="M27 81 61 37 186 27 215 66 193 112 47 126Z" fill="#bfcaca" />
                <path d="M27 81 173 70 215 66 193 112 47 126Z" fill="#aebdc0" />
                <path d="m173 70 13-43 29 39-22 46-20-42Z" fill="#8c9da4" />
                <path d="M27 81 61 37 186 27 173 70Z" fill="#dde5df" />
                <path d="m62 49 91-7" fill="none" stroke="#f7f8ee" strokeWidth="5" />
              </g>
            </g>
          </g>
          <g transform="translate(280 315) scale(1.05) rotate(-3)">
            <g>
              <g stroke="#8d7139" strokeWidth="4">
                <path d="M27 81 61 37 186 27 215 66 193 112 47 126Z" fill="#e7bd54" />
                <path d="M27 81 173 70 215 66 193 112 47 126Z" fill="#d3a442" />
                <path d="m173 70 13-43 29 39-22 46-20-42Z" fill="#bd9039" />
                <path d="M27 81 61 37 186 27 173 70Z" fill="#f5d879" />
                <path d="m62 49 91-7" fill="none" stroke="#fff0b4" strokeWidth="5" />
              </g>
            </g>
          </g>
          <g transform="translate(370 188) scale(0.81) rotate(12)">
            <g>
              <ellipse
                cx="145"
                cy="119"
                rx="95"
                ry="73"
                fill="none"
                stroke="#9c956f"
                strokeWidth="4"
              />
            </g>
            <g stroke="#8b8770" strokeWidth="3">
              <g>
                <circle cx="240.00" cy="119.00" r="11" fill="#f0ead5" />
                <path d="M235.00 117.00q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="236.15" cy="139.57" r="11" fill="#f0ead5" />
                <path d="M231.15 137.57q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="224.92" cy="158.47" r="11" fill="#f0ead5" />
                <path d="M219.92 156.47q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="207.21" cy="174.17" r="11" fill="#f0ead5" />
                <path d="M202.21 172.17q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="184.46" cy="185.40" r="11" fill="#f0ead5" />
                <path d="M179.46 183.40q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="158.52" cy="191.26" r="11" fill="#f0ead5" />
                <path d="M153.52 189.26q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="131.48" cy="191.26" r="11" fill="#f0ead5" />
                <path d="M126.48 189.26q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="105.54" cy="185.40" r="11" fill="#f0ead5" />
                <path d="M100.54 183.40q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="82.79" cy="174.17" r="11" fill="#f0ead5" />
                <path d="M77.79 172.17q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="65.08" cy="158.47" r="11" fill="#f0ead5" />
                <path d="M60.08 156.47q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="53.85" cy="139.57" r="11" fill="#f0ead5" />
                <path d="M48.85 137.57q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="50.00" cy="119.00" r="11" fill="#f0ead5" />
                <path d="M45.00 117.00q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="53.85" cy="98.43" r="11" fill="#f0ead5" />
                <path d="M48.85 96.43q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="65.08" cy="79.53" r="11" fill="#f0ead5" />
                <path d="M60.08 77.53q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="82.79" cy="63.83" r="11" fill="#f0ead5" />
                <path d="M77.79 61.83q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="105.54" cy="52.60" r="11" fill="#f0ead5" />
                <path d="M100.54 50.60q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="131.48" cy="46.74" r="11" fill="#f0ead5" />
                <path d="M126.48 44.74q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="158.52" cy="46.74" r="11" fill="#f0ead5" />
                <path d="M153.52 44.74q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="184.46" cy="52.60" r="11" fill="#f0ead5" />
                <path d="M179.46 50.60q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="207.21" cy="63.83" r="11" fill="#f0ead5" />
                <path d="M202.21 61.83q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="224.92" cy="79.53" r="11" fill="#f0ead5" />
                <path d="M219.92 77.53q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
              <g>
                <circle cx="236.15" cy="98.43" r="11" fill="#f0ead5" />
                <path d="M231.15 96.43q0-5 5-5" fill="none" stroke="#fffbed" strokeWidth="3" />
              </g>
            </g>
            <g stroke="#8d7139" strokeWidth="4">
              <circle cx="145" cy="201" r="7" fill="#f5d879" />
              <path d="m145 208 17 23-17 23-17-23Z" fill="#e7bd54" />
              <path
                d="m145 216 10 15-10 15-10-15Z"
                fill="#be6672"
                stroke="#874c53"
                strokeWidth="2"
              />
            </g>
          </g>
          <g transform="translate(540 261) scale(0.7) rotate(20)">
            <g>
              <g stroke="#476d5c" strokeWidth="4">
                <path d="M59 22h83l23 26v119l-24 23H57l-24-26V48Z" fill="#77a382" />
                <path d="M70 46h60l14 17v90l-16 14H70l-16-17V63Z" fill="#abd1a5" />
                <path
                  d="m59 22 11 24m72-24-12 24m35 2-21 15m21 104-21-14m-3 37-13-23m-71 23 13-23m-37-3 21-14M33 48l21 15"
                  fill="none"
                />
                <path d="M68 72v55" fill="none" stroke="#e1edc8" strokeWidth="5" />
              </g>
            </g>
          </g>
          <g transform="translate(175 305) scale(0.67) rotate(-19)">
            <g>
              <g stroke="#874c53" strokeWidth="4">
                <path
                  d="M100 25 137 33 170 62 180 104 160 142 123 165 78 159 38 130 22 92 43 52Z"
                  fill="#be6672"
                />
                <path
                  d="m100 25-15 38-42-11m42 11 48 3 4-33m-4 33 16 44 31-6m-31 6-29 27 3 28m-3-28-51-8 9 30m-9-30-18-36-29-1m29 1 34-30"
                  fill="none"
                />
                <path d="m85 63 48 3 16 44-29 27-51-8-18-36Z" fill="#df9292" />
                <path d="m69 83-7 12 8 17" fill="none" stroke="#f9ceba" strokeWidth="5" />
              </g>
            </g>
          </g>
          <g transform="translate(550 122) scale(0.73) rotate(8)">
            <g>
              <g stroke="#587f8b" strokeWidth="4">
                <path d="M28 67 63 28H155L194 67 110 169Z" fill="#c8e5e7" />
                <path d="M28 67h166L110 169Z" fill="#9ecbd5" />
                <path d="m76 67 34 102 36-102Z" fill="#e6f4eb" />
                <path d="m63 28 13 39 34-39 36 39 9-39M28 67h166M76 67l34 102 36-102" fill="none" />
                <path d="m48 57 18-19m93 7 12 12" fill="none" stroke="#f8fcf2" strokeWidth="5" />
              </g>
            </g>
          </g>
          <g transform="translate(431 334) scale(0.86) rotate(2)">
            <g stroke="#8d7139" strokeWidth="4">
              <path d="M33 97v39c0 17 104 17 104 0V97" fill="#d3a442" />
              <path d="M33 110c0 17 104 17 104 0M33 123c0 17 104 17 104 0" fill="none" />
              <ellipse cx="85" cy="97" rx="52" ry="16" fill="#f5d879" />
              <path d="m78 92 18 0 0 9-18 0Z" fill="#b38e46" strokeWidth="2" />
              <ellipse
                cx="159"
                cy="137"
                rx="39"
                ry="18"
                fill="#e7bd54"
                transform="rotate(-13 159 137)"
              />
              <path d="m150 134 16-3 2 10-16 3Z" fill="#b38e46" strokeWidth="2" />
            </g>
          </g>
          <g transform="translate(49 340) scale(0.55) rotate(-17)">
            <g>
              <g stroke="#536781" strokeWidth="4">
                <path d="m107 19 48 64 23 45-14 34-37 28-43-3-43-25-17-35 30-49Z" fill="#7c98ba" />
                <path
                  d="m107 19-20 74-33-15m33 15 48-2 20-8m-20 8 15 46 28-9m-28 9-42 27 19 26m-19-26-43-28-24 26m24-26 22-43m-22 43-41-9"
                  fill="none"
                />
                <path d="m87 93 48-2 15 46-42 27-43-28Z" fill="#b0c4dd" />
                <path d="m97 62 5-19m-21 71-4 12" fill="none" stroke="#e4eced" strokeWidth="5" />
              </g>
            </g>
          </g>
          <g transform="translate(620 322) scale(0.65) rotate(5)">
            <g>
              <g stroke="#667579" strokeWidth="4">
                <path
                  d="m22 117 15-28 25-5 4-26 35-16 23 12 19-5 22 29-8 24 21 14-16 28-35-2-18 13-33-15-34 4Z"
                  fill="#bfcaca"
                />
                <path
                  d="m22 117 39-9 24 13 34-13 38-6 21 14-16 28-35-2-18 13-33-15-34 4Z"
                  fill="#8c9da4"
                  stroke="none"
                />
                <path
                  d="m37 89 24 19 5-50 19 19 16-35m-16 35 34 31 24-59m-24 59 8 34m-42-21-9 19"
                  fill="none"
                  stroke="#8c9da4"
                  strokeWidth="3"
                />
                <path
                  d="m77 62 20-9m44 23 8 12M44 100l9 8"
                  fill="none"
                  stroke="#f7f8ee"
                  strokeWidth="5"
                />
              </g>
            </g>
          </g>
        </g>
      </svg>
    ),
  },
  basket: {
    label: "Rổ tre",
    sockets: ["prop"],
    aspect: 392 / 226,
    draw: (box) => <Basket {...box} />,
  },
};
