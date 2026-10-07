/** Same UI and final URL; every request stays below the Vercel body limit. */
export async function uploadMedia(file: File) {
  if (!file.size || file.size > 5242880) throw Error("حد الصورة 5 MB");
  const json = async (response: Response) => {
    const result = await response.json();
    if (!response.ok) throw Error(result.error || "تعذر رفع الصورة");
    return result;
  };
  const send = (body: unknown) =>
    fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(json);
  const { uploadId, chunkSize } = await send({
    action: "start",
    name: file.name,
    type: file.type,
    size: file.size,
  });
  for (
    let offset = 0, part = 0;
    offset < file.size;
    offset += chunkSize, part++
  ) {
    const body = file.slice(offset, offset + chunkSize);
    const response = await fetch(
      `/api/media?upload=${encodeURIComponent(uploadId)}&part=${part}`,
      { method: "PUT", body },
    );
    await json(response);
  }
  return send({ action: "complete", uploadId }) as Promise<{ url: string }>;
}
