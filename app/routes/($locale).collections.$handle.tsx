import {json, redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, Link, type MetaFunction} from '@remix-run/react';
import {
  Pagination,
  getPaginationVariables,
  Image,
  Money,
} from '@shopify/hydrogen';
import type {ProductItemFragment} from 'storefrontapi.generated';
import {useVariantUrl} from '~/utils';
import {useGSAP} from '@gsap/react';
import gsap from 'gsap';
import {useRef} from 'react';

export const meta: MetaFunction<typeof loader> = ({data}) => {
  return [{title: `Hydrogen | ${data?.collection.title ?? ''} Collection`}];
};

export async function loader({request, params, context}: LoaderFunctionArgs) {
  const {handle} = params;
  const {storefront} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 8,
  });

  if (!handle) {
    return redirect('/collections');
  }

  const {collection} = await storefront.query(COLLECTION_QUERY, {
    variables: {handle, ...paginationVariables},
  });

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {
      status: 404,
    });
  }
  return json({collection});
}

export default function Collection() {
  const {collection} = useLoaderData<typeof loader>();
  const collectionTitleRef = useRef(null);
  const collectionDescriptionRef = useRef(null);

  useGSAP(
    () => {
      const tl = gsap.timeline();
      tl.delay(0.2);
      tl.fromTo(
        collectionTitleRef.current,
        {opacity: 0, scale: 1.02},
        {opacity: 1, scale: 1, duration: 0.6},
      );
      tl.fromTo(
        collectionDescriptionRef.current,
        {opacity: 0, scale: 1.02},
        {opacity: 1, scale: 1, duration: 0.6},
      );
      tl.fromTo(
        '.product-grid-item',
        {opacity: 0, scale: 1.02},
        {opacity: 1, scale: 1, duration: 0.8, stagger: 0.1},
      );
    },
    {dependencies: [collection.title]},
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <h1
        className="font-display text-5xl md:text-6xl font-light italic"
        ref={collectionTitleRef}
      >
        {collection.title}
      </h1>
      <p
        className="my-8 max-w-lg text-lg md:text-xl text-gray-500"
        ref={collectionDescriptionRef}
      >
        {collection.description}
      </p>
      <Pagination connection={collection.products}>
        {({nodes, isLoading, PreviousLink, NextLink}) => (
          <>
            <PreviousLink>
              {isLoading ? 'Loading...' : <span>↑ Load previous</span>}
            </PreviousLink>
            {/* <ProductsGrid products={nodes} /> */}
            <div className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(var(--grid-item-width),1fr))] mb-8">
              {nodes.map((product, index) => {
                return (
                  <div className="product-grid-item" key={product.id}>
                    <ProductItem
                      product={product}
                      loading={index < 8 ? 'eager' : undefined}
                    />
                  </div>
                );
              })}
            </div>
            <NextLink>
              {isLoading ? 'Loading...' : <span>Load more ↓</span>}
            </NextLink>
          </>
        )}
      </Pagination>
    </div>
  );
}

// function ProductsGrid({products}: {products: ProductItemFragment[]}) {
//   return (
//     <div className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(var(--grid-item-width),1fr))] mb-8">
//       {products.map((product, index) => {
//         return (
//           <div className="product-grid-item">
//             <ProductItem
//               key={product.id}
//               product={product}
//               loading={index < 8 ? 'eager' : undefined}
//             />
//           </div>
//         );
//       })}
//     </div>
//   );
// }

function ProductItem({
  product,
  loading,
}: {
  product: ProductItemFragment;
  loading?: 'eager' | 'lazy';
}) {
  const variant = product.variants.nodes[0];
  const variantUrl = useVariantUrl(product.handle, variant.selectedOptions);

  return (
    <div className="relative w-full overflow-hidden" key={product.id}>
      {product.featuredImage && (
        <Image
          alt={product.featuredImage.altText || product.title}
          aspectRatio="1/1"
          data={product.featuredImage}
          loading={loading}
          sizes="(min-width: 45em) 400px, 100vw"
          className="w-full h-auto"
        />
      )}
      <div className="absolute inset-0 flex flex-col justify-end items-start">
        <div className="py-2 px-4 bg-white/70">
          <Link
            prefetch="intent"
            to={variantUrl}
            className="hover:no-underline group"
          >
            <span aria-hidden="true" className="absolute inset-0" />
            <h4 className="text-base md:text-xl">{product.title}</h4>
            <hr
              aria-hidden="true"
              className="border-b-2 border-black w-0 group-hover:w-full transition-[width] duration-300"
            />
          </Link>
          <Money
            className="text-sm md:text-base"
            withoutTrailingZeros={true}
            data={product.priceRange.minVariantPrice}
          />
        </div>
      </div>
    </div>
  );
}

const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
    id
    handle
    title
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
    variants(first: 1) {
      nodes {
        selectedOptions {
          name
          value
        }
      }
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor
      ) {
        nodes {
          ...ProductItem
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
` as const;
