export type XImage = {
  url: string;
  alt?: string;
};

export type XPost = {
  id: string;
  url: string;
  authorName: string;
  authorHandle: string;
  createdAt: string;
  text: string;
  images: XImage[];
};

export type GenerateOptions = {
  includeThread: boolean;
  saveImagesLocally: boolean;
  includeFrontMatter: boolean;
};

export type ExtractResult =
  | {
      ok: true;
      post: XPost;
    }
  | {
      ok: false;
      error: string;
    };
