export type TravelSlide = {
  src: string
  location: string
}

const locationNames: Record<string, string> = {
  '安徽': 'Anhui',
  '澳门': 'Macau',
  '北京': 'Beijing',
  '重庆': 'Chongqing',
  '福建': 'Fujian',
  '甘肃': 'Gansu',
  '广东': 'Guangdong',
  '广西': 'Guangxi',
  '贵州': 'Guizhou',
  '海南': 'Hainan',
  '河北': 'Hebei',
  '河南': 'Henan',
  '黑龙江': 'Heilongjiang',
  '湖北': 'Hubei',
  '湖南': 'Hunan',
  '吉林': 'Jilin',
  '江苏': 'Jiangsu',
  '江西': 'Jiangxi',
  '辽宁': 'Liaoning',
  '内蒙古': 'Inner Mongolia',
  '宁夏': 'Ningxia',
  '青海': 'Qinghai',
  '山东': 'Shandong',
  '山西': 'Shanxi',
  '陕西': 'Shaanxi',
  '上海': 'Shanghai',
  '四川': 'Sichuan',
  '台湾': 'Taiwan',
  '天津': 'Tianjin',
  '西藏': 'Tibet',
  '香港': 'Hong Kong',
  '新疆': 'Xinjiang',
  '云南': 'Yunnan',
  '浙江': 'Zhejiang',
}

export const travelSlides: TravelSlide[] = Object.entries(locationNames).map(
  ([fileName, location]) => ({
    src: `${import.meta.env.BASE_URL}images/${encodeURIComponent(fileName)}.jpg`,
    location,
  }),
)

export function shuffleTravelSlides(
  slides: readonly TravelSlide[],
  random: () => number = Math.random,
) {
  const shuffled = [...slides]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ]
  }

  return shuffled
}
