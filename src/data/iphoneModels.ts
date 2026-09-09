export interface IPhoneModel {
  id: string;
  name: string;
  image: string;
  display: {
    name: string;
    price: number;
    image: string;
    specifications: Record<string, string>;
    stock: number;
    description: string;
  };
  battery: {
    name: string;
    price: number;
    image: string;
    specifications: Record<string, string>;
    stock: number;
    description: string;
  };
}

const createDisplay = (modelName: string, price: number, image: string, specs: Record<string, string>) => {
  const technology = specs['Technology']?.toUpperCase().includes('LCD') ? 'LCD' : 'OLED'
  return {
    name: `${modelName} ${technology} Display Assembly`,
    price,
    image,
    specifications: {
      "Part Type": `${technology} Display Assembly`,
      "Condition": "New (Genuine Apple)",
      "Compatibility": modelName,
      ...specs
    },
    stock: 10,
    description: `Genuine Apple ${technology} Display Assembly replacement for ${modelName}. Includes display, digitizer, and front glass.`
  }
};

const createBattery = (modelName: string, price: number, image: string, specs: Record<string, string>) => ({
  name: `${modelName} Replacement Battery Kit`,
  price,
  image,
  specifications: {
    "Part Type": "Replacement Battery Kit",
    "Condition": "New (Genuine Apple)",
    "Compatibility": modelName,
    ...specs
  },
  stock: 20,
  description: `Genuine replacement battery for ${modelName}. Restores factory battery life and performance.`
});

export const iphoneModels: IPhoneModel[] = [
  // iPhone 17 Series
  {
    id: "iphone-17-pro-max",
    name: "iPhone 17 Pro Max",
    image: "/images/products/iphone/iphone-17-pro-max.jpg",
    display: createDisplay("iPhone 17 Pro Max", 379, "/images/products/iphone/iphone-17-pro-max.jpg", { "Size": "6.9-inch", "Resolution": "2868 × 1320 pixels", "Technology": "OLED / ProMotion" }),
    battery: createBattery("iPhone 17 Pro Max", 119, "/images/products/iphone/iphone-17-pro-max.jpg", { "Capacity": "4676 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-17-pro",
    name: "iPhone 17 Pro",
    image: "/images/products/iphone/iphone-17-pro.jpg",
    display: createDisplay("iPhone 17 Pro", 329, "/images/products/iphone/iphone-17-pro.jpg", { "Size": "6.3-inch", "Resolution": "2622 × 1206 pixels", "Technology": "OLED / ProMotion" }),
    battery: createBattery("iPhone 17 Pro", 119, "/images/products/iphone/iphone-17-pro.jpg", { "Capacity": "3577 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-air",
    name: "iPhone Air",
    image: "/images/products/iphone/iphone-air.jpg",
    display: createDisplay("iPhone Air", 349, "/images/products/iphone/iphone-air.jpg", { "Size": "6.6-inch", "Resolution": "2740 × 1260 pixels", "Technology": "OLED / ProMotion" }),
    battery: createBattery("iPhone Air", 119, "/images/products/iphone/iphone-air.jpg", { "Capacity": "4000 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-17",
    name: "iPhone 17",
    image: "/images/products/iphone/iphone-17.jpg",
    display: createDisplay("iPhone 17", 279, "/images/products/iphone/iphone-17.jpg", { "Size": "6.1-inch", "Resolution": "2556 × 1179 pixels", "Technology": "OLED" }),
    battery: createBattery("iPhone 17", 119, "/images/products/iphone/iphone-17.jpg", { "Capacity": "3274 mAh", "Chemistry": "Lithium-ion polymer" })
  },

  // iPhone 16 Series
  {
    id: "iphone-16-pro-max",
    name: "iPhone 16 Pro Max",
    image: "/images/products/iphone/iphone-16-pro-max.jpg",
    display: createDisplay("iPhone 16 Pro Max", 379, "/images/products/iphone/iphone-16-pro-max.jpg", { "Size": "6.9-inch", "Resolution": "2868 × 1320 pixels", "Technology": "OLED / ProMotion" }),
    battery: createBattery("iPhone 16 Pro Max", 119, "/images/products/iphone/iphone-16-pro-max.jpg", { "Capacity": "4676 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-16-pro",
    name: "iPhone 16 Pro",
    image: "/images/products/iphone/iphone-16-pro.jpg",
    display: createDisplay("iPhone 16 Pro", 329, "/images/products/iphone/iphone-16-pro.jpg", { "Size": "6.3-inch", "Resolution": "2622 × 1206 pixels", "Technology": "OLED / ProMotion" }),
    battery: createBattery("iPhone 16 Pro", 119, "/images/products/iphone/iphone-16-pro.jpg", { "Capacity": "3577 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-16-plus",
    name: "iPhone 16 Plus",
    image: "/images/products/iphone/iphone-16-plus.jpg",
    display: createDisplay("iPhone 16 Plus", 329, "/images/products/iphone/iphone-16-plus.jpg", { "Size": "6.7-inch", "Resolution": "2796 × 1290 pixels", "Technology": "OLED" }),
    battery: createBattery("iPhone 16 Plus", 99, "/images/products/iphone/iphone-16-plus.jpg", { "Capacity": "4383 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-16",
    name: "iPhone 16",
    image: "/images/products/iphone/iphone-16.jpg",
    display: createDisplay("iPhone 16", 279, "/images/products/iphone/iphone-16.jpg", { "Size": "6.1-inch", "Resolution": "2556 × 1179 pixels", "Technology": "OLED" }),
    battery: createBattery("iPhone 16", 99, "/images/products/iphone/iphone-16.jpg", { "Capacity": "3561 mAh", "Chemistry": "Lithium-ion polymer" })
  },

  // iPhone 15 Series
  {
    id: "iphone-15-pro-max",
    name: "iPhone 15 Pro Max",
    image: "/images/products/iphone/iphone-15-pro-max.jpg",
    display: createDisplay("iPhone 15 Pro Max", 379, "/images/products/iphone/iphone-15-pro-max.jpg", { "Size": "6.7-inch", "Resolution": "2796 × 1290 pixels", "Technology": "OLED / ProMotion" }),
    battery: createBattery("iPhone 15 Pro Max", 99, "/images/products/iphone/iphone-15-pro-max.jpg", { "Capacity": "4422 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-15-pro",
    name: "iPhone 15 Pro",
    image: "/images/products/iphone/iphone-15-pro.jpg",
    display: createDisplay("iPhone 15 Pro", 329, "/images/products/iphone/iphone-15-pro.jpg", { "Size": "6.1-inch", "Resolution": "2556 × 1179 pixels", "Technology": "OLED / ProMotion" }),
    battery: createBattery("iPhone 15 Pro", 99, "/images/products/iphone/iphone-15-pro.jpg", { "Capacity": "3274 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-15-plus",
    name: "iPhone 15 Plus",
    image: "/images/products/iphone/iphone-15-plus.jpg",
    display: createDisplay("iPhone 15 Plus", 329, "/images/products/iphone/iphone-15-plus.jpg", { "Size": "6.7-inch", "Resolution": "2796 × 1290 pixels", "Technology": "OLED" }),
    battery: createBattery("iPhone 15 Plus", 99, "/images/products/iphone/iphone-15-plus.jpg", { "Capacity": "4383 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-15",
    name: "iPhone 15",
    image: "/images/products/iphone/iphone-15.jpg",
    display: createDisplay("iPhone 15", 279, "/images/products/iphone/iphone-15.jpg", { "Size": "6.1-inch", "Resolution": "2556 × 1179 pixels", "Technology": "OLED" }),
    battery: createBattery("iPhone 15", 99, "/images/products/iphone/iphone-15.jpg", { "Capacity": "3349 mAh", "Chemistry": "Lithium-ion polymer" })
  },

  // iPhone 14 Series
  {
    id: "iphone-14-pro-max",
    name: "iPhone 14 Pro Max",
    image: "/images/products/iphone/iphone-14-pro-max.jpg",
    display: createDisplay("iPhone 14 Pro Max", 379, "/images/products/iphone/iphone-14-pro-max.jpg", { "Size": "6.7-inch", "Resolution": "2796 × 1290 pixels", "Technology": "OLED / ProMotion" }),
    battery: createBattery("iPhone 14 Pro Max", 99, "/images/products/iphone/iphone-14-pro-max.jpg", { "Capacity": "4323 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-14-pro",
    name: "iPhone 14 Pro",
    image: "/images/products/iphone/iphone-14-pro.jpg",
    display: createDisplay("iPhone 14 Pro", 319, "/images/products/iphone/iphone-14-pro.jpg", { "Size": "6.1-inch", "Resolution": "2556 × 1179 pixels", "Technology": "OLED / ProMotion" }),
    battery: createBattery("iPhone 14 Pro", 99, "/images/products/iphone/iphone-14-pro.jpg", { "Capacity": "3200 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-14-plus",
    name: "iPhone 14 Plus",
    image: "/images/products/iphone/iphone-14-plus.jpg",
    display: createDisplay("iPhone 14 Plus", 329, "/images/products/iphone/iphone-14-plus.jpg", { "Size": "6.7-inch", "Resolution": "2778 × 1284 pixels", "Technology": "OLED" }),
    battery: createBattery("iPhone 14 Plus", 99, "/images/products/iphone/iphone-14-plus.jpg", { "Capacity": "4325 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-14",
    name: "iPhone 14",
    image: "/images/products/iphone/iphone-14.jpg",
    display: createDisplay("iPhone 14", 229, "/images/products/iphone/iphone-14.jpg", { "Size": "6.1-inch", "Resolution": "2532 × 1170 pixels", "Technology": "OLED" }),
    battery: createBattery("iPhone 14", 99, "/images/products/iphone/iphone-14.jpg", { "Capacity": "3279 mAh", "Chemistry": "Lithium-ion polymer" })
  },

  // iPhone 13 Series
  {
    id: "iphone-13-pro-max",
    name: "iPhone 13 Pro Max",
    image: "/images/products/iphone/iphone-13-pro-max.jpg",
    display: createDisplay("iPhone 13 Pro Max", 329, "/images/products/iphone/iphone-13-pro-max.jpg", { "Size": "6.7-inch", "Resolution": "2778 × 1284 pixels", "Technology": "OLED / ProMotion" }),
    battery: createBattery("iPhone 13 Pro Max", 89, "/images/products/iphone/iphone-13-pro-max.jpg", { "Capacity": "4352 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-13-pro",
    name: "iPhone 13 Pro",
    image: "/images/products/iphone/iphone-13-pro.jpg",
    display: createDisplay("iPhone 13 Pro", 279, "/images/products/iphone/iphone-13-pro.jpg", { "Size": "6.1-inch", "Resolution": "2532 × 1170 pixels", "Technology": "OLED / ProMotion" }),
    battery: createBattery("iPhone 13 Pro", 89, "/images/products/iphone/iphone-13-pro.jpg", { "Capacity": "3095 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-13",
    name: "iPhone 13",
    image: "/images/products/iphone/iphone-13.jpg",
    display: createDisplay("iPhone 13", 229, "/images/products/iphone/iphone-13.jpg", { "Size": "6.1-inch", "Resolution": "2532 × 1170 pixels", "Technology": "OLED" }),
    battery: createBattery("iPhone 13", 89, "/images/products/iphone/iphone-13.jpg", { "Capacity": "3227 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-13-mini",
    name: "iPhone 13 mini",
    image: "/images/products/iphone/iphone-13-mini.jpg",
    display: createDisplay("iPhone 13 mini", 229, "/images/products/iphone/iphone-13-mini.jpg", { "Size": "5.4-inch", "Resolution": "2340 × 1080 pixels", "Technology": "OLED" }),
    battery: createBattery("iPhone 13 mini", 89, "/images/products/iphone/iphone-13-mini.jpg", { "Capacity": "2406 mAh", "Chemistry": "Lithium-ion polymer" })
  },

  // iPhone 12 Series
  {
    id: "iphone-12-pro-max",
    name: "iPhone 12 Pro Max",
    image: "/images/products/iphone/iphone-12-pro-max.jpg",
    display: createDisplay("iPhone 12 Pro Max", 329, "/images/products/iphone/iphone-12-pro-max.jpg", { "Size": "6.7-inch", "Resolution": "2778 × 1284 pixels", "Technology": "OLED" }),
    battery: createBattery("iPhone 12 Pro Max", 69, "/images/products/iphone/iphone-12-pro-max.jpg", { "Capacity": "3687 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-12-pro",
    name: "iPhone 12 Pro",
    image: "/images/products/iphone/iphone-12-pro.jpg",
    display: createDisplay("iPhone 12 Pro", 269, "/images/products/iphone/iphone-12-pro.jpg", { "Size": "6.1-inch", "Resolution": "2532 × 1170 pixels", "Technology": "OLED" }),
    battery: createBattery("iPhone 12 Pro", 69, "/images/products/iphone/iphone-12-pro.jpg", { "Capacity": "2815 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-12",
    name: "iPhone 12",
    image: "/images/products/iphone/iphone-12.jpg",
    display: createDisplay("iPhone 12", 229, "/images/products/iphone/iphone-12.jpg", { "Size": "6.1-inch", "Resolution": "2532 × 1170 pixels", "Technology": "OLED" }),
    battery: createBattery("iPhone 12", 69, "/images/products/iphone/iphone-12.jpg", { "Capacity": "2815 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-12-mini",
    name: "iPhone 12 mini",
    image: "/images/products/iphone/iphone-12-mini.jpg",
    display: createDisplay("iPhone 12 mini", 229, "/images/products/iphone/iphone-12-mini.jpg", { "Size": "5.4-inch", "Resolution": "2340 × 1080 pixels", "Technology": "OLED" }),
    battery: createBattery("iPhone 12 mini", 69, "/images/products/iphone/iphone-12-mini.jpg", { "Capacity": "2227 mAh", "Chemistry": "Lithium-ion polymer" })
  },

  // iPhone 11 Series
  {
    id: "iphone-11-pro-max",
    name: "iPhone 11 Pro Max",
    image: "/images/products/iphone/iphone-11-pro-max.jpg",
    display: createDisplay("iPhone 11 Pro Max", 279, "/images/products/iphone/iphone-11-pro-max.jpg", { "Size": "6.5-inch", "Resolution": "2688 × 1242 pixels", "Technology": "OLED" }),
    battery: createBattery("iPhone 11 Pro Max", 89, "/images/products/iphone/iphone-11-pro-max.jpg", { "Capacity": "3969 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-11-pro",
    name: "iPhone 11 Pro",
    image: "/images/products/iphone/iphone-11-pro.jpg",
    display: createDisplay("iPhone 11 Pro", 249, "/images/products/iphone/iphone-11-pro.jpg", { "Size": "5.8-inch", "Resolution": "2436 × 1125 pixels", "Technology": "OLED" }),
    battery: createBattery("iPhone 11 Pro", 89, "/images/products/iphone/iphone-11-pro.jpg", { "Capacity": "3046 mAh", "Chemistry": "Lithium-ion polymer" })
  },
  {
    id: "iphone-11",
    name: "iPhone 11",
    image: "/images/products/iphone/iphone-11.jpg",
    display: createDisplay("iPhone 11", 139, "/images/products/iphone/iphone-11.jpg", { "Size": "6.1-inch", "Resolution": "1792 × 828 pixels", "Technology": "LCD", "Part Type": "LCD Display Assembly" }),
    battery: createBattery("iPhone 11", 69, "/images/products/iphone/iphone-11.jpg", { "Capacity": "3110 mAh", "Chemistry": "Lithium-ion polymer" })
  }
];
