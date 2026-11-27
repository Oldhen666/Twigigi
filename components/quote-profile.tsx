export function QuoteProfileBlock({
  name,
  bio,
  logo,
  photos,
}: {
  name?: string;
  bio?: string;
  logo?: string;
  photos: string[];
}) {
  if (!name && !bio && !logo && photos.length === 0) return null;
  return (
    <div>
      {name || logo ? (
        <div className="flex items-center gap-3">
          {logo ? (
            // Blob previews and stored uploads both render here. next/image rejects the blob URLs.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="size-14 shrink-0 rounded-xl border border-line bg-white object-contain" />
          ) : null}
          {name ? <h2 className="font-serif text-2xl">{name}</h2> : null}
        </div>
      ) : null}
      {bio ? <p className="mt-2 text-sm leading-6">{bio}</p> : null}
      {photos.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {photos.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="h-[72px] w-[72px] rounded-xl object-cover" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
