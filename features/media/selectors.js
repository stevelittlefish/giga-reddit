// The media downloader's Reddit DOM selectors. Checked on live Reddit, logged
// in, in Brave with Shields on (2026-10-04). Needs shared/selectors.js for the
// post, comment and comment body elements.

var giga = globalThis.giga || (globalThis.giga = {});
giga.media = giga.media || {};

giga.media.selectors = {
  // Reddit's video player, for post videos and comment videos alike. Its src
  // attribute is the signed HLS master playlist. Attributes used: post-id,
  // comment-id (comment videos only), poster, and post-promoted, which marks an
  // advert that Shields let through.
  player: 'shreddit-player',
  // A gallery post's carousel. It carries a post-id attribute.
  gallery: 'gallery-carousel',
  // Inside the carousel, one per slide: the full-size i.redd.it original. The
  // slide's other two imgs are resized previews.
  galleryFullImage: 'zoomable-img img',
};
