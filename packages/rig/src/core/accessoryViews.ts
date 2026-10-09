import type { ViewArt } from "./views";

export const ACCESSORY_SIDE: Record<string, ViewArt> = {
  "side-mole": {
    label: "Nốt ruồi nhìn nghiêng",
    shapes: [
      { d: "M 224 225 C 224 221 230 221 230 225 C 230 229 224 229 224 225 Z", fill: "line", k: 0 },
    ],
  },
  "side-baseball": {
    label: "Mũ lưỡi trai nhìn nghiêng",
    shapes: [
      {
        d: "M 57 135 C 53 78 97 43 159 44 C 220 43 250 79 253 118 L 305 130 Q 317 139 301 145 L 238 145 Q 150 127 57 145 Z",
      },
      {
        d: "M 157 46 Q 211 67 214 125 M 59 129 Q 157 113 251 128",
        fill: "none",
        k: 0.65,
      },
    ],
  },
  "side-brim": {
    label: "Mũ vành rộng nhìn nghiêng",
    shapes: [
      {
        d: "M 36 129 L 79 114 L 92 51 Q 137 35 161 54 Q 184 37 221 55 L 238 114 L 295 137 Q 274 163 225 146 Q 119 134 58 152 Q 26 151 36 129 Z",
      },
      {
        d: "M 81 105 Q 161 121 235 106 M 79 117 Q 166 132 238 118",
        fill: "none",
        k: 0.65,
      },
    ],
  },
  "side-conical": {
    label: "Nón lá nhìn nghiêng",
    shapes: [
      {
        d: "M 155 12 Q 220 65 311 126 Q 177 156 10 128 Q 99 66 155 12 Z",
      },
      {
        d: "M 155 12 Q 166 64 203 143 M 16 127 Q 165 143 303 126",
        fill: "none",
        k: 0.65,
      },
    ],
  },
  "side-pith": {
    label: "Mũ cối nhìn nghiêng",
    shapes: [
      {
        d: "M 37 130 L 63 110 C 65 61 101 35 155 38 C 214 35 249 66 252 111 L 291 132 Q 269 150 233 140 Q 151 126 76 145 Q 44 149 37 130 Z",
      },
      {
        d: "M 65 111 Q 156 96 251 112 M 156 40 Q 191 67 193 103",
        fill: "none",
        k: 0.65,
      },
    ],
  },
  "side-police": {
    label: "Mũ cảnh sát nhìn nghiêng",
    shapes: [
      {
        d: "M 64 116 L 42 65 Q 145 16 260 63 L 246 115 L 303 129 Q 304 145 274 147 L 236 135 L 68 139 Z",
      },
      {
        d: "M 65 114 Q 162 98 245 113 L 238 135 M 228 65 L 244 73 L 237 94 L 225 89 Z",
        fill: "none",
        k: 0.65,
      },
    ],
  },
  "side-medical": {
    label: "Mũ bác sĩ nhìn nghiêng",
    shapes: [
      {
        d: "M 62 133 L 65 65 Q 151 35 247 67 L 253 135 Q 157 119 62 133 Z",
      },
      {
        d: "M 69 117 Q 158 103 248 118 M 218 77 L 228 77 L 228 87 L 238 87 L 238 97 L 228 97 L 228 107 L 218 107 L 218 97 L 208 97 L 208 87 L 218 87 Z",
        fill: "none",
        k: 0.65,
      },
    ],
  },
  "side-army": {
    label: "Mũ quân đội nhìn nghiêng",
    shapes: [
      {
        d: "M 61 128 L 67 65 Q 161 47 243 72 L 250 117 L 304 128 Q 314 143 289 146 L 239 136 L 62 139 Z",
      },
      {
        d: "M 68 83 Q 156 71 243 86 M 63 117 Q 158 103 248 119",
        fill: "none",
        k: 0.65,
      },
    ],
  },
  "side-wrap": {
    label: "Khăn quấn đầu nhìn nghiêng",
    shapes: [
      {
        d: "M 61 143 C 37 88 70 47 124 42 C 163 19 225 47 244 80 Q 271 110 250 144 Q 153 121 61 143 Z",
      },
      {
        d: "M 66 130 Q 153 91 236 74 M 56 109 Q 151 89 215 51 M 92 55 Q 140 94 251 120",
        fill: "none",
        k: 0.65,
      },
    ],
  },
  "side-band": {
    label: "Băng trán nhìn nghiêng",
    shapes: [
      {
        d: "M 60 112 Q 157 90 258 114 L 257 140 Q 156 117 60 139 Z",
      },
      {
        d: "M 63 115 L 45 147 L 63 183 L 76 143",
        fill: "none",
        k: 0.65,
      },
    ],
  },
  "side-hardhat": {
    label: "Mũ bảo hộ nhìn nghiêng",
    shapes: [
      {
        d: "M 44 132 L 60 116 C 61 70 98 36 149 38 L 150 27 L 172 27 L 176 39 C 222 45 248 72 252 115 L 285 125 L 288 139 Q 164 127 48 146 Z",
      },
      {
        d: "M 151 40 L 155 105 M 173 40 L 181 105 M 63 115 Q 157 102 251 116",
        fill: "none",
        k: 0.65,
      },
    ],
  },
  "side-cap": {
    label: "Mũ chỏm nhìn nghiêng",
    shapes: [
      {
        d: "M 62 123 C 68 76 107 50 159 51 C 211 49 246 79 255 123 Q 159 111 62 123 Z",
      },
      {
        d: "M 160 52 Q 203 72 209 119",
        fill: "none",
        k: 0.65,
      },
    ],
  },
  "side-horn": {
    label: "Sừng nhìn nghiêng",
    shapes: [
      {
        d: "M 157 96 C 136 68 128 36 145 9 Q 143 46 184 89 Z",
      },
    ],
  },
  "side-scarf": {
    label: "Khăn quàng nhìn nghiêng",
    shapes: [
      {
        d: "M 61 10 Q 77 17 94 10 L 101 27 L 115 92 L 97 98 L 85 35 Q 64 36 55 26 Z",
      },
      {
        d: "M 57 25 Q 78 34 98 23 M 99 83 L 111 79",
        fill: "none",
        k: 0.65,
      },
    ],
  },
  "side-plate": {
    label: "Phiến hộ tâm nhìn nghiêng",
    shapes: [
      {
        d: "M 87 14 L 102 41 L 111 51 L 121 76 Q 118 92 111 97 L 99 87 L 95 54 L 91 42 L 76 17 Z",
      },
      {
        d: "M 102 53 L 109 80 L 113 84",
        fill: "none",
        k: 0.65,
      },
    ],
  },
  "side-beads": {
    label: "Chuỗi hạt nhìn nghiêng",
    shapes: [
      {
        d: "M 62 14 C 61 49 80 80 102 82 C 120 78 108 36 88 14",
        fill: "none",
      },
      {
        d: "M 63 18 Q 65 47 78 64 Q 91 84 103 76 Q 109 58 90 19",
        fill: "none",
        k: 0.65,
      },
      {
        d: "M 57 23 C 57 15.02 69 15.02 69 23 C 69 30.98 57 30.98 57 23 Z",
        k: 0.5,
      },
      {
        d: "M 59 36 C 59 28.02 71 28.02 71 36 C 71 43.980000000000004 59 43.980000000000004 59 36 Z",
        k: 0.5,
      },
      {
        d: "M 63 49 C 63 41.019999999999996 75 41.019999999999996 75 49 C 75 56.980000000000004 63 56.980000000000004 63 49 Z",
        k: 0.5,
      },
      {
        d: "M 70 61 C 70 53.019999999999996 82 53.019999999999996 82 61 C 82 68.98 70 68.98 70 61 Z",
        k: 0.5,
      },
      {
        d: "M 80 71 C 80 63.019999999999996 92 63.019999999999996 92 71 C 92 78.98 80 78.98 80 71 Z",
        k: 0.5,
      },
      {
        d: "M 93 76 C 93 68.02 105 68.02 105 76 C 105 83.98 93 83.98 93 76 Z",
        k: 0.5,
      },
      {
        d: "M 101 65 C 101 57.019999999999996 113 57.019999999999996 113 65 C 113 72.98 101 72.98 101 65 Z",
        k: 0.5,
      },
      {
        d: "M 98 51 C 98 43.019999999999996 110 43.019999999999996 110 51 C 110 58.980000000000004 98 58.980000000000004 98 51 Z",
        k: 0.5,
      },
      {
        d: "M 92 37 C 92 29.02 104 29.02 104 37 C 104 44.980000000000004 92 44.980000000000004 92 37 Z",
        k: 0.5,
      },
      {
        d: "M 86 24 C 86 16.02 98 16.02 98 24 C 98 31.98 86 31.98 86 24 Z",
        k: 0.5,
      },
    ],
  },
  "side-skirt": {
    label: "Váy nhìn nghiêng",
    shapes: [
      {
        d: "M 51 98 Q 75 102.4 101 98 C 111 138.4 120 181 128 242.2 Q 77 250.6 25 241 C 36 179.8 45 134.2 51 98 Z",
      },
      {
        d: "M 52 106 Q 77 109 102 106 M 94 119.8 Q 101 178.6 110 231.4 M 29 229 Q 79 238 124 230.8",
        fill: "none",
        k: 0.65,
      },
    ],
  },
  "side-panels": {
    label: "Tà áo dài nhìn nghiêng",
    shapes: [
      {
        d: "M 50 96 L 101 96 Q 108 170.8 122 245.8 L 85 248.8 L 71 145 L 66 248.8 L 31 243.4 Q 45 163.6 50 96 Z",
      },
      {
        d: "M 75 100.6 L 71 145",
        fill: "none",
        k: 0.65,
      },
    ],
  },
  "side-robe": {
    label: "Tà áo thụng nhìn nghiêng",
    shapes: [
      {
        d: "M 47 49 Q 76 55 103 49 C 107 132.4 113 203.2 121 262.6 Q 80 269.8 28 263.2 C 38 201.4 44 131.2 47 49 Z",
      },
      {
        d: "M 92 60 Q 89 175.6 97 264.4 M 57 118 Q 53 203.2 45 254.8",
        fill: "none",
        k: 0.65,
      },
    ],
  },
  "side-loincloth": {
    label: "Khố nhìn nghiêng",
    shapes: [
      {
        d: "M 46 96 Q 76 101.8 105 96 L 110 109.6 L 115 184 L 91 191.2 L 89 111.4 L 58 110.2 L 46 170.8 L 32 165.4 Z",
      },
      {
        d: "M 48 104.8 Q 77 109 106 104.8 M 96 166 L 112 161.2 M 96 173.8 L 113 169",
        fill: "none",
        k: 0.65,
      },
    ],
  },
  "side-apron": {
    label: "Tạp dề nhìn nghiêng",
    shapes: [
      {
        d: "M 91 21 L 108 29 L 111 99 Q 114 150.4 134 210.4 L 106 215.2 Q 99 164.8 97 107.2 L 49 106 L 49 99 L 98 99 Z",
      },
      {
        d: "M 103 30 L 111 3 M 112 133 L 123 133.6 L 127 152.2 L 116 153.4 M 50 100.6 L 27 91 L 36 107.8 L 50 103.6",
        fill: "none",
        k: 0.65,
      },
    ],
  },
  "side-sleeve": {
    label: "Tay áo nhìn nghiêng",
    shapes: [
      {
        d: "M 10 21 Q 11 2 30 2 Q 48 3 49 23 L 47 91 Q 29 101 12 91 Z",
      },
      {
        d: "M 12 80 Q 30 89 47 80",
        fill: "none",
        k: 0.65,
      },
    ],
  },
  "side-puff": {
    label: "Tay bồng nhìn nghiêng",
    shapes: [
      {
        d: "M 24 2 C 3 6 0 26 7 46 Q 9 66 19 77 L 19 95 Q 30 100 42 94 L 43 75 C 59 52 58 12 37 3 Z",
      },
      {
        d: "M 19 77 Q 30 82 43 75 M 24 12 Q 14 39 23 65",
        fill: "none",
        k: 0.65,
      },
    ],
  },
};

export const ACCESSORY_SIDE_OF: Record<string, string> = {
  mole: "side-mole",
  "crown-01": "side-baseball",
  "crown-02": "side-brim",
  "crown-03": "side-conical",
  nonla: "side-conical",
  "crown-04": "side-pith",
  "crown-05": "side-police",
  "crown-06": "side-medical",
  "crown-07": "side-army",
  "crown-08": "side-wrap",
  khan: "side-wrap",
  headband: "side-band",
  helmet: "side-hardhat",
  cap: "side-cap",
  sung: "side-horn",
  khanco: "side-scarf",
  plate: "side-plate",
  beads: "side-beads",
  skirt: "side-skirt",
  ta: "side-panels",
  "sage-hem": "side-robe",
  loincloth: "side-loincloth",
  apron: "side-apron",
  sleeve: "side-sleeve",
  puff: "side-puff",
};
