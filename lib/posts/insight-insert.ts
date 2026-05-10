export type CreateInsightInput = {
  title: string;
  body: string;
  cover_url?: string;
  images?: string[];
  tags?: string[];
  content_type?: "community" | "news";
};

export function buildInsightInsertPayload(input: CreateInsightInput, authorId: string) {
  return {
    title: input.title.trim(),
    body: input.body.trim(),
    cover_url: input.cover_url,
    images: input.images,
    tags: input.tags,
    content_type: input.content_type,
    author_id: authorId,
    heat: 0,
  };
}
