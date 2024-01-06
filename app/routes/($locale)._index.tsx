import {defer, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {Await, useLoaderData, Link, type MetaFunction} from '@remix-run/react';
import {Suspense, useRef} from 'react';
import {Image, Money} from '@shopify/hydrogen';
import type {
  FeaturedCollectionFragment,
  RecommendedProductsQuery,
} from 'storefrontapi.generated';
import womanWalking from '~/assets/woman-walking.mp4';
import {Swiper, SwiperSlide} from 'swiper/react';
import {Navigation, A11y} from 'swiper/modules';
import swiperStyles from 'swiper/swiper-bundle.css';
import swiperCustomStyles from '~/styles/swiper-custom.css';
import {useGSAP} from '@gsap/react';
import gsap from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {Observer} from 'gsap/Observer';

export const meta: MetaFunction = () => {
  return [{title: 'Hydrogen | Home'}];
};

export const links = () => {
  return [
    {rel: 'stylesheet', href: swiperStyles},
    {rel: 'stylesheet', href: swiperCustomStyles},
  ];
};

export async function loader({context}: LoaderFunctionArgs) {
  const {storefront} = context;
  const {collections} = await storefront.query(FEATURED_COLLECTION_QUERY);
  const featuredCollection = collections.nodes[0];
  const recommendedProducts = storefront.query(RECOMMENDED_PRODUCTS_QUERY);

  return defer({featuredCollection, recommendedProducts});
}

export default function Homepage() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="home">
      <FeaturedCollection collection={data.featuredCollection} />
      <RecommendedProducts products={data.recommendedProducts} />
    </div>
  );
}

function FeaturedCollection({
  collection,
}: {
  collection: FeaturedCollectionFragment;
}) {
  const featuredMain = useRef(null);

  useGSAP(
    () => {
      const displayTexts = gsap.utils.toArray('.display-text');
      displayTexts.forEach((displayText, i) => {
        gsap.fromTo(
          displayText!,
          {
            opacity: 0,
            scale: 1.15,
          },
          {
            opacity: 1,
            scale: 1,
            duration: 0.3,
            delay: i === 2 ? 1.5 : i * 0.3 + 0.5,
          },
        );
      });
    },
    {scope: featuredMain},
  );

  if (!collection) return null;

  return (
    // <Link
    //   className="featured-collection"
    //   to={`/collections/${collection.handle}`}
    // >
    // {image && (
    //   <div className="featured-collection-image">
    //     <Image data={image} sizes="100vw" />
    //   </div>
    // )}
    // </Link>
    <div className="relative">
      <div className="absolute top-0 left-0 w-full h-full bg-gray-900/40" />
      <video
        className="w-full h-full object-cover"
        src={womanWalking}
        autoPlay
        loop
        muted
      />
      <div
        ref={featuredMain}
        className="absolute w-full h-full top-0 flex flex-col justify-center items-center"
      >
        <h1 className="font-display font-thin text-white space-y-4 flex flex-col items-center">
          <div className="display-text text-4xl md:text-7xl lg:text-8xl">
            Elegant Styles
          </div>
          <div className="display-text italic text-3xl md:text-6xl lg:text-7xl">
            For Any Wardrobe
          </div>
        </h1>
        <Link
          to={`/collections/${collection.handle}`}
          className="display-text text-white hover:no-underline mt-4 md:mt-8 text:xl md:text-2xl group"
        >
          Shop our featured collection →
          <hr aria-hidden="true" className="border-white border-b-4 w-0 group-hover:w-full transition-[width] duration-300" />
        </Link>
      </div>
    </div>
  );
}

function RecommendedProducts({
  products,
}: {
  products: Promise<RecommendedProductsQuery>;
}) {
  const recommendedMain = useRef(null);
  gsap.registerPlugin(ScrollTrigger, Observer);

  useGSAP(
    () => {
      gsap.fromTo(
        '.header-text',
        {
          opacity: 0,
          scaleY: 1.15,
        },
        {
          scrollTrigger: {
            trigger: '.header-text',
            start: 'bottom bottom',
          },
          opacity: 1,
          scaleY: 1,
          duration: 0.3,
          delay: 0,
        },
      );

      const slideImages = gsap.utils.toArray('.slide-image');
      slideImages.forEach((slideImage: any, i: number) => {
        gsap.fromTo(
          slideImage!,
          {
            opacity: 0,
            scale: 1.15,
          },
          {
            scrollTrigger: {
              trigger: slideImage,
              start: 'bottom bottom',
            },
            opacity: 1,
            scale: 1,
            duration: 0.3,
            delay: i * 0.1,
          },
        );
      });

      const slideContainers = gsap.utils.toArray('.slide-container');
      slideContainers.forEach((slideContainer: any, i: number) => {
        slideContainer.addEventListener('mouseover', () => {
          gsap.to(`.slide-image-${i}`, {
            scale: 1.05,
            duration: 0.3,
          });
        })

        slideContainer.addEventListener('mouseout', () => {
          gsap.to(`.slide-image-${i}`, {
            scale: 1,
            duration: 0.3,
          });
        })
      });
    },
    {scope: recommendedMain},
  );

  return (
    <div
      ref={recommendedMain}
      className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12"
    >
      <h2 className="header-text font-display text-2xl md:text-3xl mb-6">
        Your Personalized Selections
      </h2>
      <Suspense fallback={<div>Loading...</div>}>
        <Await resolve={products}>
          {({products}) => (
            <Swiper
              navigation={true}
              modules={[Navigation, A11y]}
              spaceBetween={25}
              slidesPerView={1}
              breakpoints={{
                480: {
                  slidesPerView: 2,
                },
                998: {
                  slidesPerView: 3,
                },
              }}
            >
              {products.nodes.map((product, i) => (
                <SwiperSlide key={product.id}>
                  <div className="slide-container relative w-full">
                    <Image
                      data={product.images.nodes[0]}
                      aspectRatio="1/1"
                      sizes="(min-width: 45em) 20vw, 50vw"
                      className={`slide-image slide-image-${i}`}
                    />
                    <div className="absolute inset-0 flex flex-col justify-end items-start">
                      <div className="py-2 px-4 bg-white/70">
                        <Link
                          to={`/products/${product.handle}`}
                          className="hover:no-underline group"
                        >
                          <span
                            aria-hidden="true"
                            className="absolute inset-0"
                          />
                          <h4 className="text-base md:text-xl">
                            {product.title}
                          </h4>
                          <hr aria-hidden="true" className="border-b-2 border-black w-0 group-hover:w-full transition-[width] duration-300" />
                        </Link>
                        <Money
                          className="text-sm md:text-base"
                          withoutTrailingZeros={true}
                          data={product.priceRange.minVariantPrice}
                        />
                      </div>
                    </div>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          )}
        </Await>
      </Suspense>
    </div>
  );
}

const FEATURED_COLLECTION_QUERY = `#graphql
  fragment FeaturedCollection on Collection {
    id
    title
    image {
      id
      url
      altText
      width
      height
    }
    handle
  }
  query FeaturedCollection($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collections(first: 1, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...FeaturedCollection
      }
    }
  }
` as const;

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  fragment RecommendedProduct on Product {
    id
    title
    handle
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    images(first: 1) {
      nodes {
        id
        url
        altText
        width
        height
      }
    }
  }
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 4, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...RecommendedProduct
      }
    }
  }
` as const;
