import {Suspense, useEffect, useRef, useState} from 'react';
import {defer, redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {
  Await,
  Link,
  useLoaderData,
  type MetaFunction,
  type FetcherWithComponents,
  useSearchParams,
} from '@remix-run/react';
import type {
  ProductFragment,
  ProductVariantsQuery,
  ProductVariantFragment,
} from 'storefrontapi.generated';

import {
  Image,
  Money,
  VariantSelector,
  type VariantOption,
  getSelectedProductOptions,
  CartForm,
} from '@shopify/hydrogen';
import type {
  CartLineInput,
  SelectedOption,
} from '@shopify/hydrogen/storefront-api-types';
import {getVariantUrl} from '~/utils';
import clsx from 'clsx';
import {useGSAP} from '@gsap/react';
import gsap from 'gsap';

export const meta: MetaFunction<typeof loader> = ({data}) => {
  return [{title: `Hydrogen | ${data?.product.title ?? ''}`}];
};

export async function loader({params, request, context}: LoaderFunctionArgs) {
  const {handle} = params;
  const {storefront} = context;

  const selectedOptions = getSelectedProductOptions(request).filter(
    (option) =>
      // Filter out Shopify predictive search query params
      !option.name.startsWith('_sid') &&
      !option.name.startsWith('_pos') &&
      !option.name.startsWith('_psq') &&
      !option.name.startsWith('_ss') &&
      !option.name.startsWith('_v') &&
      // Filter out third party tracking params
      !option.name.startsWith('fbclid'),
  );

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  // await the query for the critical product data
  const {product} = await storefront.query(PRODUCT_QUERY, {
    variables: {handle, selectedOptions},
  });

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  const firstVariant = product.variants.nodes[0];
  const firstVariantIsDefault = Boolean(
    firstVariant.selectedOptions.find(
      (option: SelectedOption) =>
        option.name === 'Title' && option.value === 'Default Title',
    ),
  );

  if (firstVariantIsDefault) {
    product.selectedVariant = firstVariant;
  } else {
    // if no selected variant was returned from the selected options,
    // we redirect to the first variant's url with it's selected options applied
    if (!product.selectedVariant) {
      throw redirectToFirstVariant({product, request});
    }
  }

  // In order to show which variants are available in the UI, we need to query
  // all of them. But there might be a *lot*, so instead separate the variants
  // into it's own separate query that is deferred. So there's a brief moment
  // where variant options might show as available when they're not, but after
  // this deffered query resolves, the UI will update.
  const variants = storefront.query(VARIANTS_QUERY, {
    variables: {handle},
  });

  return defer({product, variants});
}

function redirectToFirstVariant({
  product,
  request,
}: {
  product: ProductFragment;
  request: Request;
}) {
  const url = new URL(request.url);
  const firstVariant = product.variants.nodes[0];

  return redirect(
    getVariantUrl({
      pathname: url.pathname,
      handle: product.handle,
      selectedOptions: firstVariant.selectedOptions,
      searchParams: new URLSearchParams(url.search),
    }),
    {
      status: 302,
    },
  );
}

export default function Product() {
  const {product, variants} = useLoaderData<typeof loader>();
  const {selectedVariant} = product;
  const imageWrapper = useRef(null);
  const [selectedVariantImage, setSelectedVariantImage] = useState<
    ProductVariantFragment['image'] | null
  >(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [searchParams] = useSearchParams();

  useGSAP(
    () => {
      const tl = gsap.timeline();
      tl.to(imageWrapper.current, {
        autoAlpha: 0,
        scale: 1.02,
        duration: 0.3,
      });
      tl.call(() => {
        setSelectedVariantImage(selectedVariant?.image);
        setImageLoaded(false);
      });
    },
    {dependencies: [searchParams.get('Color')]},
  );

  useGSAP(() => {
    const tl = gsap.timeline();
    if (imageLoaded) {
      tl.to(imageWrapper.current, {
        autoAlpha: 1,
        scale: 1,
        duration: 0.3,
      });
    }
  }, [imageLoaded]);

  return (
    <div className="product mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div ref={imageWrapper}>
        <ProductImage
          image={selectedVariantImage}
          onLoad={() => setImageLoaded(true)}
        />
      </div>
      <ProductMain
        selectedVariant={selectedVariant}
        product={product}
        variants={variants}
      />
    </div>
  );
}

function ProductImage({
  image,
  onLoad,
}: {
  image: ProductVariantFragment['image'] | null;
  onLoad?: () => void;
}) {
  if (!image) {
    return <div className="product-image" />;
  }
  return (
    <div className="product-image">
      <Image
        alt={image.altText || 'Product Image'}
        aspectRatio="1/1"
        data={image}
        key={image.id}
        sizes="(min-width: 45em) 50vw, 100vw"
        onLoad={onLoad}
      />
    </div>
  );
}

function ProductMain({
  selectedVariant,
  product,
  variants,
}: {
  product: ProductFragment;
  selectedVariant: ProductFragment['selectedVariant'];
  variants: Promise<ProductVariantsQuery>;
}) {
  const {title, descriptionHtml} = product;
  return (
    <div className="product-main">
      <h1 className="font-display text-4xl mb-2">{title}</h1>
      <div className="text-xl mb-8">
        <ProductPrice selectedVariant={selectedVariant} />
      </div>
      <Suspense
        fallback={
          <ProductForm
            product={product}
            selectedVariant={selectedVariant}
            variants={[]}
          />
        }
      >
        <Await
          errorElement="There was a problem loading product variants"
          resolve={variants}
        >
          {(data) => (
            <ProductForm
              product={product}
              selectedVariant={selectedVariant}
              variants={data.product?.variants.nodes || []}
            />
          )}
        </Await>
      </Suspense>

      <hr className="border-b-2 w-60 border-gray-600 mt-16 mb-4" />
      <div
        className="text-gray-600 text-sm"
        dangerouslySetInnerHTML={{__html: descriptionHtml}}
      />
    </div>
  );
}

function ProductPrice({
  selectedVariant,
}: {
  selectedVariant: ProductFragment['selectedVariant'];
}) {
  return (
    <div className="product-price">
      {selectedVariant?.compareAtPrice ? (
        <>
          <p>Sale</p>
          <div className="product-price-on-sale">
            {selectedVariant ? (
              <Money data={selectedVariant.price} withoutTrailingZeros={true} />
            ) : null}
            <s>
              <Money
                data={selectedVariant.compareAtPrice}
                withoutTrailingZeros={true}
              />
            </s>
          </div>
        </>
      ) : (
        selectedVariant?.price && (
          <Money data={selectedVariant?.price} withoutTrailingZeros={true} />
        )
      )}
    </div>
  );
}

function ProductForm({
  product,
  selectedVariant,
  variants,
}: {
  product: ProductFragment;
  selectedVariant: ProductFragment['selectedVariant'];
  variants: Array<ProductVariantFragment>;
}) {
  return (
    <div className="product-form">
      <VariantSelector
        handle={product.handle}
        options={product.options}
        variants={variants}
      >
        {({option}) => <ProductOptions key={option.name} option={option} />}
      </VariantSelector>
      <AddToCartButton
        disabled={!selectedVariant || !selectedVariant.availableForSale}
        onClick={() => {
          window.location.href = window.location.href + '#cart-aside';
        }}
        lines={
          selectedVariant
            ? [
                {
                  merchandiseId: selectedVariant.id,
                  quantity: 1,
                },
              ]
            : []
        }
      >
        {selectedVariant?.availableForSale ? 'Add to cart' : 'Sold out'}
      </AddToCartButton>
    </div>
  );
}

function ProductOptions({option}: {option: VariantOption}) {
  if (option.name === 'Size') {
    const sizesTruncated: any = {
      'X-Small': 'XS',
      Small: 'S',
      Medium: 'M',
      Large: 'L',
      'X-Large': 'XL',
      'XX-Large': 'XXL',
      '1': '1',
      '2': '2',
      '3': '3',
      '4': '4',
      '5': '5',
      '6': '6',
      '7': '7',
      '8': '8',
      '9': '9',
      '10': '10',
      '11': '11',
      '12': '12',
      '13': '13',
      '14': '14',
      '15': '15',
      '16': '16',
    };

    return (
      <div className="my-8">
        <h5 className="mb-2">{option.name}</h5>
        <div key={option.name} className="flex flex-row space-x-2">
          {option.values.map(({value, isAvailable, isActive, to}) => (
            <Link
              className={clsx(
                isAvailable ? 'opacity-100' : 'opacity-30',
                isActive ? 'border border-black' : 'border border-gray-300',
                'p-0.5 text-sm font-bold hover:no-underline hover: hover:bg-gray-100 transition-colors',
              )}
              key={option.name + value}
              prefetch="intent"
              preventScrollReset
              replace
              to={to}
              aria-label={value}
              title={value}
            >
              <div className="h-8 w-10 flex items-center justify-center">
                {sizesTruncated[value]}
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (option.name === 'Color') {
    const colorCodes: any = {
      Green: 'bg-green-800',
      Olive: 'bg-yellow-950',
      Ocean: 'bg-sky-800',
      Purple: 'bg-violet-950',
      Red: 'bg-rose-900',
    };

    return (
      <div className="my-8">
        <h5 className="mb-2">{option.name}</h5>
        <div key={option.name} className="flex flex-row space-x-2">
          {option.values.map(({value, isAvailable, isActive, to}) => (
            <Link
              className={clsx(
                isAvailable ? 'opacity-100' : 'opacity-30',
                isActive ? 'border border-black' : 'border border-gray-300',
                'p-0.5 text-sm font-bold hover:no-underline hover: hover:bg-gray-200 transition-colors',
              )}
              key={option.name + value}
              prefetch="intent"
              preventScrollReset
              replace
              to={to}
              aria-label={value}
              title={value}
            >
              <div className={`h-8 w-10 ${colorCodes[value]}`} />
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="product-options" key={option.name}>
      <h5>{option.name}</h5>
      <div className="product-options-grid">
        {option.values.map(({value, isAvailable, isActive, to}) => {
          return (
            <Link
              className={clsx(
                isAvailable ? 'opacity-100' : 'opacity-30',
                isActive ? 'border border-black' : 'border border-gray-300',
                'px-4 py-2 mr-2 mb-2 text-sm bg-blue-500 font-bold hover:no-underline hover: hover:bg-gray-100 transition-colors',
              )}
              key={option.name + value}
              prefetch="intent"
              preventScrollReset
              replace
              to={to}
            >
              {value}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
}: {
  analytics?: unknown;
  children: React.ReactNode;
  disabled?: boolean;
  lines: CartLineInput[];
  onClick?: () => void;
}) {
  return (
    <CartForm route="/cart" inputs={{lines}} action={CartForm.ACTIONS.LinesAdd}>
      {(fetcher: FetcherWithComponents<any>) => (
        <>
          <input
            name="analytics"
            type="hidden"
            value={JSON.stringify(analytics)}
          />
          <div className="mt-12">
            <button
              type="submit"
              onClick={onClick}
              disabled={disabled ?? fetcher.state !== 'idle'}
              className="border border-black p-0.5 text-white text-sm font-bold hover:no-underline hover:bg-black transition-all duration-200"
            >
              <div className="bg-black px-4 py-2">{children}</div>
              
            </button>
          </div>
        </>
      )}
    </CartForm>
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
` as const;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
    options {
      name
      values
    }
    selectedVariant: variantBySelectedOptions(selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    variants(first: 1) {
      nodes {
        ...ProductVariant
      }
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;

const PRODUCT_VARIANTS_FRAGMENT = `#graphql
  fragment ProductVariants on Product {
    variants(first: 250) {
      nodes {
        ...ProductVariant
      }
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const VARIANTS_QUERY = `#graphql
  ${PRODUCT_VARIANTS_FRAGMENT}
  query ProductVariants(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...ProductVariants
    }
  }
` as const;
