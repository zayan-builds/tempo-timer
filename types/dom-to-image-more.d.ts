declare module "dom-to-image-more" {
  type Options = {
    width?: number;
    height?: number;
    quality?: number;
    bgcolor?: string;
    style?: Partial<CSSStyleDeclaration>;
    cacheBust?: boolean;
    filter?: (node: Node) => boolean;
    scale?: number;
  };
  const lib: {
    toPng: (node: Node, options?: Options) => Promise<string>;
    toJpeg: (node: Node, options?: Options) => Promise<string>;
    toBlob: (node: Node, options?: Options) => Promise<Blob>;
    toSvg: (node: Node, options?: Options) => Promise<string>;
  };
  export default lib;
}
