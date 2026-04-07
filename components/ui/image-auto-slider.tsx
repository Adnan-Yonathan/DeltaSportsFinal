"use client";

import React from "react";

const BET_PROOF_IMAGES = [
  "/betproof/IMG_8459.PNG",
  "/betproof/IMG_8460.PNG",
  "/betproof/IMG_8461.PNG",
  "/test1.png",
  "/betproof/IMG_8462.PNG",
  "/betproof/IMG_8463.PNG",
  "/test2.png",
  "/betproof/IMG_8464.PNG",
  "/test3.png",
  "/betproof/IMG_8465.PNG",
  "/test4.jpg",
  "/betproof/IMG_8466.PNG",
  "/test5.PNG",
  "/betproof/IMG_8467.PNG",
  "/test6.png",
];

export const ImageAutoSlider = () => {
  const duplicatedImages = [...BET_PROOF_IMAGES, ...BET_PROOF_IMAGES];

  return (
    <section className="w-full overflow-hidden rounded-3xl border border-white/10 bg-black/60 py-8 sm:py-10">
      <div className="relative z-10 w-full">
        <div className="scroll-container w-full">
          <div className="infinite-scroll flex w-max gap-4 px-4 sm:gap-6 sm:px-6">
            {duplicatedImages.map((image, index) => (
              <div
                key={`${image}-${index}`}
                className="image-item relative h-52 w-36 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-2xl sm:h-64 sm:w-44 md:h-80 md:w-56"
              >
                <img
                  src={image}
                  alt={`Bet proof ${(index % BET_PROOF_IMAGES.length) + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scroll-right {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .infinite-scroll {
          animation: scroll-right 24s linear infinite;
        }

        .scroll-container {
          mask: linear-gradient(
            90deg,
            transparent 0%,
            black 8%,
            black 92%,
            transparent 100%
          );
          -webkit-mask: linear-gradient(
            90deg,
            transparent 0%,
            black 8%,
            black 92%,
            transparent 100%
          );
        }

        .image-item {
          transition: transform 0.3s ease, filter 0.3s ease;
        }

        .image-item:hover {
          transform: scale(1.03);
          filter: brightness(1.08);
        }
      `}</style>
    </section>
  );
};

export const Component = ImageAutoSlider;

export default ImageAutoSlider;
