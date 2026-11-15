export function bookmarkletHref(siteUrl: string) {
  const addUrl = new URL("/add", siteUrl).href;
  const script = `window.open(${JSON.stringify(addUrl)}+"?url="+encodeURIComponent(location.href)+"&title="+encodeURIComponent(document.title),"schnellbuch","width=420,height=320")`;
  return `javascript:(()=>{${script}})()`;
}
