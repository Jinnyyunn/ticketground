"use client";

import { getImageProps } from "next/image";
import * as ReactDOM from "react-dom";
import { homeFeaturedImagePolicy } from "./home-featured-image-policy";

export function HomeFeaturedImagePreload() {
  const { props } = getImageProps(homeFeaturedImagePolicy);

  ReactDOM.preload(props.src, {
    as: "image",
    fetchPriority: homeFeaturedImagePolicy.fetchPriority,
    imageSizes: props.sizes,
    imageSrcSet: props.srcSet,
  });

  return null;
}
