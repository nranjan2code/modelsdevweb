export function BrandMark({ boxClassName = "", size = 24 }: { boxClassName?: string; size?: number }) {
  return (
    <span className={`flex items-center justify-center rounded-lg bg-white shadow-sm ${boxClassName}`}>
      <svg viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: size, height: size }} aria-hidden="true">
        <circle cx="512" cy="512" r="450" fill="url(#brand_grad)" fillOpacity="0.1" />
        <path d="M720 292H300V352H480V712C480 792 540 852 620 852H640V792H620C575.817 792 540 756.183 540 712V352H720V292Z" fill="#1E293B" />
        <path d="M430 392C347.157 392 280 459.157 280 542C280 624.843 347.157 692 430 692C512.843 692 580 624.843 580 542C580 459.157 512.843 392 430 392ZM430 632C380.294 632 340 591.706 340 542C340 492.294 380.294 452 430 452C479.706 452 520 492.294 520 542C520 591.706 479.706 632 430 632Z" fill="#1E293B" />
        <path d="M300 292V312H720V292H300Z" fill="#F59E0B" />
        <defs>
          <radialGradient id="brand_grad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(512 512) rotate(90) scale(450)">
            <stop stopColor="#6366F1" />
            <stop offset="1" stopColor="#A855F7" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </span>
  );
}
