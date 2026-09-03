export interface IPhoneModel {
  id: string;
  model: string;
  image: string;
  compatibility: string[];
  display: {
    type: string;
    size: string;
    resolution: string;
    technology: string;
    price: number;
  };
  battery: {
    capacity: string;
    type: string;
    price: number;
  };
}

// Generate base models programmatically for brevity and accuracy where specs follow patterns
export const iphoneModels: IPhoneModel[] = [
  // iPhone 17 Series
  { id: "iphone-17-pro-max", model: "iPhone 17 Pro Max", image: "/images/products/iphone/iphone-17-pro-max.jpg", compatibility: ["iPhone 17 Pro Max"], display: { type: "Super Retina XDR OLED", size: "6.9-inch", resolution: "2868 × 1320 pixels", technology: "OLED / ProMotion", price: 379 }, battery: { capacity: "4676 mAh", type: "Lithium-ion polymer", price: 119 } },
  { id: "iphone-17-pro", model: "iPhone 17 Pro", image: "/images/products/iphone/iphone-17-pro.jpg", compatibility: ["iPhone 17 Pro"], display: { type: "Super Retina XDR OLED", size: "6.3-inch", resolution: "2622 × 1206 pixels", technology: "OLED / ProMotion", price: 329 }, battery: { capacity: "3577 mAh", type: "Lithium-ion polymer", price: 119 } },
  { id: "iphone-17-air", model: "iPhone 17 Air", image: "/images/products/iphone/iphone-17-air.jpg", compatibility: ["iPhone 17 Air"], display: { type: "Super Retina XDR OLED", size: "6.6-inch", resolution: "2740 × 1260 pixels", technology: "OLED / ProMotion", price: 349 }, battery: { capacity: "4000 mAh", type: "Lithium-ion polymer", price: 119 } },
  { id: "iphone-17", model: "iPhone 17", image: "/images/products/iphone/iphone-17.jpg", compatibility: ["iPhone 17"], display: { type: "Super Retina XDR OLED", size: "6.1-inch", resolution: "2556 × 1179 pixels", technology: "OLED", price: 279 }, battery: { capacity: "3274 mAh", type: "Lithium-ion polymer", price: 119 } },

  // iPhone 16 Series
  { id: "iphone-16-pro-max", model: "iPhone 16 Pro Max", image: "/images/products/iphone/iphone-16-pro-max.jpg", compatibility: ["iPhone 16 Pro Max"], display: { type: "Super Retina XDR OLED", size: "6.9-inch", resolution: "2868 × 1320 pixels", technology: "OLED / ProMotion", price: 379 }, battery: { capacity: "4676 mAh", type: "Lithium-ion polymer", price: 119 } },
  { id: "iphone-16-pro", model: "iPhone 16 Pro", image: "/images/products/iphone/iphone-16-pro.jpg", compatibility: ["iPhone 16 Pro"], display: { type: "Super Retina XDR OLED", size: "6.3-inch", resolution: "2622 × 1206 pixels", technology: "OLED / ProMotion", price: 329 }, battery: { capacity: "3577 mAh", type: "Lithium-ion polymer", price: 119 } },
  { id: "iphone-16-plus", model: "iPhone 16 Plus", image: "/images/products/iphone/iphone-16-plus.jpg", compatibility: ["iPhone 16 Plus"], display: { type: "Super Retina XDR OLED", size: "6.7-inch", resolution: "2796 × 1290 pixels", technology: "OLED", price: 329 }, battery: { capacity: "4383 mAh", type: "Lithium-ion polymer", price: 99 } },
  { id: "iphone-16", model: "iPhone 16", image: "/images/products/iphone/iphone-16.jpg", compatibility: ["iPhone 16"], display: { type: "Super Retina XDR OLED", size: "6.1-inch", resolution: "2556 × 1179 pixels", technology: "OLED", price: 279 }, battery: { capacity: "3561 mAh", type: "Lithium-ion polymer", price: 99 } },

  // iPhone 15 Series
  { id: "iphone-15-pro-max", model: "iPhone 15 Pro Max", image: "/images/products/iphone/iphone-15-pro-max.jpg", compatibility: ["iPhone 15 Pro Max"], display: { type: "Super Retina XDR OLED", size: "6.7-inch", resolution: "2796 × 1290 pixels", technology: "OLED / ProMotion", price: 379 }, battery: { capacity: "4422 mAh", type: "Lithium-ion polymer", price: 99 } },
  { id: "iphone-15-pro", model: "iPhone 15 Pro", image: "/images/products/iphone/iphone-15-pro.jpg", compatibility: ["iPhone 15 Pro"], display: { type: "Super Retina XDR OLED", size: "6.1-inch", resolution: "2556 × 1179 pixels", technology: "OLED / ProMotion", price: 329 }, battery: { capacity: "3274 mAh", type: "Lithium-ion polymer", price: 99 } },
  { id: "iphone-15-plus", model: "iPhone 15 Plus", image: "/images/products/iphone/iphone-15-plus.jpg", compatibility: ["iPhone 15 Plus"], display: { type: "Super Retina XDR OLED", size: "6.7-inch", resolution: "2796 × 1290 pixels", technology: "OLED", price: 329 }, battery: { capacity: "4383 mAh", type: "Lithium-ion polymer", price: 99 } },
  { id: "iphone-15", model: "iPhone 15", image: "/images/products/iphone/iphone-15.jpg", compatibility: ["iPhone 15"], display: { type: "Super Retina XDR OLED", size: "6.1-inch", resolution: "2556 × 1179 pixels", technology: "OLED", price: 279 }, battery: { capacity: "3349 mAh", type: "Lithium-ion polymer", price: 99 } },

  // iPhone 14 Series
  { id: "iphone-14-pro-max", model: "iPhone 14 Pro Max", image: "/images/products/iphone/iphone-14-pro-max.jpg", compatibility: ["iPhone 14 Pro Max"], display: { type: "Super Retina XDR OLED", size: "6.7-inch", resolution: "2796 × 1290 pixels", technology: "OLED / ProMotion", price: 379 }, battery: { capacity: "4323 mAh", type: "Lithium-ion polymer", price: 99 } },
  { id: "iphone-14-pro", model: "iPhone 14 Pro", image: "/images/products/iphone/iphone-14-pro.jpg", compatibility: ["iPhone 14 Pro"], display: { type: "Super Retina XDR OLED", size: "6.1-inch", resolution: "2556 × 1179 pixels", technology: "OLED / ProMotion", price: 319 }, battery: { capacity: "3200 mAh", type: "Lithium-ion polymer", price: 99 } },
  { id: "iphone-14-plus", model: "iPhone 14 Plus", image: "/images/products/iphone/iphone-14-plus.jpg", compatibility: ["iPhone 14 Plus"], display: { type: "Super Retina XDR OLED", size: "6.7-inch", resolution: "2778 × 1284 pixels", technology: "OLED", price: 329 }, battery: { capacity: "4325 mAh", type: "Lithium-ion polymer", price: 99 } },
  { id: "iphone-14", model: "iPhone 14", image: "/images/products/iphone/iphone-14.jpg", compatibility: ["iPhone 14"], display: { type: "Super Retina XDR OLED", size: "6.1-inch", resolution: "2532 × 1170 pixels", technology: "OLED", price: 229 }, battery: { capacity: "3279 mAh", type: "Lithium-ion polymer", price: 99 } },

  // iPhone 13 Series
  { id: "iphone-13-pro-max", model: "iPhone 13 Pro Max", image: "/images/products/iphone/iphone-13-pro-max.jpg", compatibility: ["iPhone 13 Pro Max"], display: { type: "Super Retina XDR OLED", size: "6.7-inch", resolution: "2778 × 1284 pixels", technology: "OLED / ProMotion", price: 329 }, battery: { capacity: "4352 mAh", type: "Lithium-ion polymer", price: 89 } },
  { id: "iphone-13-pro", model: "iPhone 13 Pro", image: "/images/products/iphone/iphone-13-pro.jpg", compatibility: ["iPhone 13 Pro"], display: { type: "Super Retina XDR OLED", size: "6.1-inch", resolution: "2532 × 1170 pixels", technology: "OLED / ProMotion", price: 279 }, battery: { capacity: "3095 mAh", type: "Lithium-ion polymer", price: 89 } },
  { id: "iphone-13", model: "iPhone 13", image: "/images/products/iphone/iphone-13.jpg", compatibility: ["iPhone 13"], display: { type: "Super Retina XDR OLED", size: "6.1-inch", resolution: "2532 × 1170 pixels", technology: "OLED", price: 229 }, battery: { capacity: "3227 mAh", type: "Lithium-ion polymer", price: 89 } },
  { id: "iphone-13-mini", model: "iPhone 13 mini", image: "/images/products/iphone/iphone-13-mini.jpg", compatibility: ["iPhone 13 mini"], display: { type: "Super Retina XDR OLED", size: "5.4-inch", resolution: "2340 × 1080 pixels", technology: "OLED", price: 229 }, battery: { capacity: "2406 mAh", type: "Lithium-ion polymer", price: 89 } },

  // iPhone 12 Series
  { id: "iphone-12-pro-max", model: "iPhone 12 Pro Max", image: "/images/products/iphone/iphone-12-pro-max.jpg", compatibility: ["iPhone 12 Pro Max"], display: { type: "Super Retina XDR OLED", size: "6.7-inch", resolution: "2778 × 1284 pixels", technology: "OLED", price: 329 }, battery: { capacity: "3687 mAh", type: "Lithium-ion polymer", price: 69 } },
  { id: "iphone-12-pro", model: "iPhone 12 Pro", image: "/images/products/iphone/iphone-12-pro.jpg", compatibility: ["iPhone 12 Pro"], display: { type: "Super Retina XDR OLED", size: "6.1-inch", resolution: "2532 × 1170 pixels", technology: "OLED", price: 269 }, battery: { capacity: "2815 mAh", type: "Lithium-ion polymer", price: 69 } },
  { id: "iphone-12", model: "iPhone 12", image: "/images/products/iphone/iphone-12.jpg", compatibility: ["iPhone 12"], display: { type: "Super Retina XDR OLED", size: "6.1-inch", resolution: "2532 × 1170 pixels", technology: "OLED", price: 229 }, battery: { capacity: "2815 mAh", type: "Lithium-ion polymer", price: 69 } },
  { id: "iphone-12-mini", model: "iPhone 12 mini", image: "/images/products/iphone/iphone-12-mini.jpg", compatibility: ["iPhone 12 mini"], display: { type: "Super Retina XDR OLED", size: "5.4-inch", resolution: "2340 × 1080 pixels", technology: "OLED", price: 229 }, battery: { capacity: "2227 mAh", type: "Lithium-ion polymer", price: 69 } },

  // iPhone 11 Series
  { id: "iphone-11-pro-max", model: "iPhone 11 Pro Max", image: "/images/products/iphone/iphone-11-pro-max.jpg", compatibility: ["iPhone 11 Pro Max"], display: { type: "Super Retina XDR OLED", size: "6.5-inch", resolution: "2688 × 1242 pixels", technology: "OLED", price: 279 }, battery: { capacity: "3969 mAh", type: "Lithium-ion polymer", price: 89 } },
  { id: "iphone-11-pro", model: "iPhone 11 Pro", image: "/images/products/iphone/iphone-11-pro.jpg", compatibility: ["iPhone 11 Pro"], display: { type: "Super Retina XDR OLED", size: "5.8-inch", resolution: "2436 × 1125 pixels", technology: "OLED", price: 249 }, battery: { capacity: "3046 mAh", type: "Lithium-ion polymer", price: 89 } },
  { id: "iphone-11", model: "iPhone 11", image: "/images/products/iphone/iphone-11.jpg", compatibility: ["iPhone 11"], display: { type: "Liquid Retina HD LCD", size: "6.1-inch", resolution: "1792 × 828 pixels", technology: "LCD", price: 139 }, battery: { capacity: "3110 mAh", type: "Lithium-ion polymer", price: 69 } }
];
