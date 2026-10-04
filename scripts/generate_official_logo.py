import subprocess

# Ultra-sharp, zero-blur, pixel-perfect SVG matching Screenshot_2026_1003_130231.png
svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <!-- Background Cosmic Deep Blue Radial Gradient -->
    <radialGradient id="bgGrad" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#1d357a" />
      <stop offset="35%" stop-color="#132357" />
      <stop offset="65%" stop-color="#0b143a" />
      <stop offset="100%" stop-color="#050a1e" />
    </radialGradient>

    <!-- Outer Rim Glowing Neon Gradient -->
    <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="25%" stop-color="#60a5fa" />
      <stop offset="55%" stop-color="#818cf8" />
      <stop offset="80%" stop-color="#a855f7" />
      <stop offset="100%" stop-color="#c084fc" />
    </linearGradient>

    <!-- Outer Subtle Halo Gradient (No blur filter, pure vector gradient) -->
    <radialGradient id="haloGrad" cx="50%" cy="50%" r="50%">
      <stop offset="85%" stop-color="#38bdf8" stop-opacity="0.3" />
      <stop offset="96%" stop-color="#818cf8" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#a855f7" stop-opacity="0" />
    </radialGradient>

    <!-- Sun Radial Gradient with Natural Corona (Zero blur, ultra-sharp) -->
    <radialGradient id="sunGrad" cx="45%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="25%" stop-color="#fffbeb" />
      <stop offset="55%" stop-color="#fef08a" />
      <stop offset="78%" stop-color="#facc15" />
      <stop offset="92%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#d97706" />
    </radialGradient>

    <!-- Sun Corona Ring (Pure vector gradient) -->
    <radialGradient id="sunCorona" cx="50%" cy="50%" r="50%">
      <stop offset="60%" stop-color="#facc15" stop-opacity="0.4" />
      <stop offset="85%" stop-color="#fbbf24" stop-opacity="0.2" />
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0" />
    </radialGradient>

    <!-- Left Petal Stem Gradient -->
    <linearGradient id="stemGrad" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="30%" stop-color="#0284c7" />
      <stop offset="65%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#1e3a8a" />
    </linearGradient>

    <!-- Left 3D Fold Ribbon Highlight Gradient -->
    <linearGradient id="foldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7dd3fc" />
      <stop offset="40%" stop-color="#38bdf8" />
      <stop offset="75%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#1e40af" />
    </linearGradient>

    <!-- Inner Sprout Leaf Gradient -->
    <linearGradient id="sproutGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0f766e" />
      <stop offset="35%" stop-color="#0d9488" />
      <stop offset="65%" stop-color="#14b8a6" />
      <stop offset="90%" stop-color="#4ade80" />
      <stop offset="100%" stop-color="#86efac" />
    </linearGradient>

    <!-- Bottom Curved Petal Gradient -->
    <linearGradient id="bottomPetalGrad" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="28%" stop-color="#6366f1" />
      <stop offset="58%" stop-color="#a855f7" />
      <stop offset="82%" stop-color="#ec4899" />
      <stop offset="100%" stop-color="#f472b6" />
    </linearGradient>

    <!-- AI Text Gradient -->
    <linearGradient id="aiGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#818cf8" />
      <stop offset="100%" stop-color="#c084fc" />
    </linearGradient>

    <!-- Center Ambient Vector Radial Glow (No blur filter) -->
    <radialGradient id="centerGlow" cx="50%" cy="40%" r="45%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.22" />
      <stop offset="50%" stop-color="#1e40af" stop-opacity="0.10" />
      <stop offset="100%" stop-color="#0b143a" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Outer Ambient Glow Ring -->
  <circle cx="512" cy="512" r="506" fill="url(#haloGrad)" />

  <!-- Outer Glowing Neon Rim (16px crisp sharp border) -->
  <circle cx="512" cy="512" r="488" fill="none" stroke="url(#rimGrad)" stroke-width="16" />

  <!-- Inner Dark Blue Disk -->
  <circle cx="512" cy="512" r="480" fill="url(#bgGrad)" />

  <!-- Center Ambient Light -->
  <circle cx="512" cy="400" r="320" fill="url(#centerGlow)" />

  <!-- ==================== THE FLOWER 'L' EMBLEM ==================== -->
  <!-- Sun Corona Glow -->
  <circle cx="580" cy="265" r="74" fill="url(#sunCorona)" />

  <!-- Sun Golden Orb -->
  <circle cx="580" cy="265" r="54" fill="url(#sunGrad)" stroke="#fef08a" stroke-width="1.5" />

  <!-- Main Left Stem of 'L' -->
  <path
    d="M 342 150
       C 372 150, 488 235, 488 455
       C 488 575, 402 642, 342 642
       C 290 642, 332 385, 342 150 Z"
    fill="url(#stemGrad)"
  />

  <!-- 3D Fold Edge Ribbon Highlight -->
  <path
    d="M 342 150
       C 314 275, 312 525, 350 635
       C 376 585, 412 495, 402 375
       C 394 265, 360 180, 342 150 Z"
    fill="url(#foldGrad)"
  />

  <!-- Bottom Horizontal Curved Petal -->
  <path
    d="M 342 642
       C 405 642, 530 630, 715 565
       C 725 580, 695 635, 620 655
       C 525 675, 405 660, 342 642 Z"
    fill="url(#bottomPetalGrad)"
  />

  <!-- Inner Sprout Leaf pointing toward Sun -->
  <path
    d="M 488 470
       C 498 385, 578 310, 698 288
       C 704 380, 608 450, 488 470 Z"
    fill="url(#sproutGrad)"
  />

  <!-- Subtle spine line on inner sprout leaf -->
  <path
    d="M 505 455 C 570 395, 640 340, 695 292"
    fill="none"
    stroke="#86efac"
    stroke-width="2"
    stroke-linecap="round"
    opacity="0.75"
  />

  <!-- ==================== TYPOGRAPHY ==================== -->
  <!-- LIFNIVO AI -->
  <g id="brand-text">
    <text
      x="512"
      y="762"
      text-anchor="middle"
      font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
      font-size="86"
      font-weight="800"
      letter-spacing="5"
    >
      <tspan fill="#ffffff">LIFNIVO </tspan>
      <tspan fill="url(#aiGrad)">AI</tspan>
    </text>

    <!-- Tagline: Your life. Simplified. -->
    <text
      x="512"
      y="834"
      text-anchor="middle"
      font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
      font-size="36"
      font-weight="400"
      letter-spacing="2.5"
      fill="#e2e8f0"
    >
      Your life. Simplified.
    </text>
  </g>
</svg>'''

with open("public/logo.svg", "w") as f:
    f.write(svg_content)

print("Saved public/logo.svg without blur filters")

# Also render emblem-only icon for tiny sizes (24px, 32px, 48px)
# When the emblem is rendered without text, it is huge, crisp and ultra-readable!
icon_only_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <radialGradient id="iconBgGrad" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#1d357a" />
      <stop offset="35%" stop-color="#132357" />
      <stop offset="65%" stop-color="#0b143a" />
      <stop offset="100%" stop-color="#050a1e" />
    </radialGradient>
    <linearGradient id="iconRimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="25%" stop-color="#60a5fa" />
      <stop offset="55%" stop-color="#818cf8" />
      <stop offset="80%" stop-color="#a855f7" />
      <stop offset="100%" stop-color="#c084fc" />
    </linearGradient>
    <radialGradient id="iconHaloGrad" cx="50%" cy="50%" r="50%">
      <stop offset="85%" stop-color="#38bdf8" stop-opacity="0.3" />
      <stop offset="96%" stop-color="#818cf8" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#a855f7" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="iconSunGrad" cx="45%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="25%" stop-color="#fffbeb" />
      <stop offset="55%" stop-color="#fef08a" />
      <stop offset="78%" stop-color="#facc15" />
      <stop offset="92%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#d97706" />
    </radialGradient>
    <radialGradient id="iconSunCorona" cx="50%" cy="50%" r="50%">
      <stop offset="60%" stop-color="#facc15" stop-opacity="0.4" />
      <stop offset="85%" stop-color="#fbbf24" stop-opacity="0.2" />
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="iconStemGrad" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="30%" stop-color="#0284c7" />
      <stop offset="65%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#1e3a8a" />
    </linearGradient>
    <linearGradient id="iconFoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7dd3fc" />
      <stop offset="40%" stop-color="#38bdf8" />
      <stop offset="75%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#1e40af" />
    </linearGradient>
    <linearGradient id="iconSproutGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0f766e" />
      <stop offset="35%" stop-color="#0d9488" />
      <stop offset="65%" stop-color="#14b8a6" />
      <stop offset="90%" stop-color="#4ade80" />
      <stop offset="100%" stop-color="#86efac" />
    </linearGradient>
    <linearGradient id="iconBottomGrad" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="28%" stop-color="#6366f1" />
      <stop offset="58%" stop-color="#a855f7" />
      <stop offset="82%" stop-color="#ec4899" />
      <stop offset="100%" stop-color="#f472b6" />
    </linearGradient>
    <radialGradient id="iconCenterGlow" cx="50%" cy="48%" r="48%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.25" />
      <stop offset="50%" stop-color="#1e40af" stop-opacity="0.10" />
      <stop offset="100%" stop-color="#0b143a" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Outer Ambient Halo -->
  <circle cx="512" cy="512" r="506" fill="url(#iconHaloGrad)" />

  <!-- Outer Neon Rim -->
  <circle cx="512" cy="512" r="488" fill="none" stroke="url(#iconRimGrad)" stroke-width="18" />

  <!-- Inner Dark Blue Disk -->
  <circle cx="512" cy="512" r="479" fill="url(#iconBgGrad)" />

  <!-- Center Ambient Light -->
  <circle cx="512" cy="500" r="350" fill="url(#iconCenterGlow)" />

  <!-- Centered Emblem (scaled up for maximum clarity in small avatar slots) -->
  <g transform="translate(0, 40) scale(1.1) translate(-51, -40)">
    <circle cx="580" cy="265" r="76" fill="url(#iconSunCorona)" />
    <circle cx="580" cy="265" r="56" fill="url(#iconSunGrad)" stroke="#fef08a" stroke-width="2" />
    <path
      d="M 342 150
         C 372 150, 488 235, 488 455
         C 488 575, 402 642, 342 642
         C 290 642, 332 385, 342 150 Z"
      fill="url(#iconStemGrad)"
    />
    <path
      d="M 342 150
         C 314 275, 312 525, 350 635
         C 376 585, 412 495, 402 375
         C 394 265, 360 180, 342 150 Z"
      fill="url(#iconFoldGrad)"
    />
    <path
      d="M 342 642
         C 405 642, 530 630, 715 565
         C 725 580, 695 635, 620 655
         C 525 675, 405 660, 342 642 Z"
      fill="url(#iconBottomGrad)"
    />
    <path
      d="M 488 470
         C 498 385, 578 310, 698 288
         C 704 380, 608 450, 488 470 Z"
      fill="url(#iconSproutGrad)"
    />
    <path
      d="M 505 455 C 570 395, 640 340, 695 292"
      fill="none"
      stroke="#86efac"
      stroke-width="2.5"
      stroke-linecap="round"
      opacity="0.8"
    />
  </g>
</svg>'''

with open("public/logo-icon.svg", "w") as f:
    f.write(icon_only_svg)

print("Saved public/logo-icon.svg")

# Render ultra-sharp 1024x1024 PNG and copy to public
subprocess.run(["rsvg-convert", "-w", "1024", "-h", "1024", "public/logo.svg", "-o", "public/app-profile.png"], check=True)
subprocess.run(["cp", "public/app-profile.png", "public/app-profile.jpg"], check=True)
subprocess.run(["cp", "public/app-profile.png", "src/assets/images/lifnivo_logo_1790960104587.jpg"], check=True)

# Also render emblem-only icon PNG
subprocess.run(["rsvg-convert", "-w", "512", "-h", "512", "public/logo-icon.svg", "-o", "public/app-profile-icon.png"], check=True)
subprocess.run(["rsvg-convert", "-w", "64", "-h", "64", "public/logo-icon.svg", "-o", "public/favicon.png"], check=True)
subprocess.run(["cp", "public/logo-icon.svg", "public/favicon.svg"], check=True)

print("All razor-sharp assets generated!")
