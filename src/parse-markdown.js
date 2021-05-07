module.exports = function parseMarkdown(markdown) {
  markdown = markdown.trim();
  if (!markdown) {
    throw new Error('markdown is empty');
  }
  const headings = [...markdown.matchAll(/^#{1,6} (?<title>.+)/gm)].map(({ 0: heading, 1: title, index }) => ({
    heading,
    title,
    index
  }));
  if (headings.length > 0 && headings[0].index > 0) {
    headings.unshift({
      heading: '',
      title: 'raw',
      index: 0
    });
  }
  const parsed = {};
  for (let i = 0; i < headings.length; i++) {
    if (!headings[i].title) {
      throw new Error('title is empty');
    }
    parsed[headings[i].title] = {
      heading: headings[i].heading,
      content: markdown.slice(
        headings[i].index + headings[i].heading.length + 1,
        i < headings.length - 1
          ? headings[i + 1].index
          : undefined
      ).trim()
    };
  }
  return parsed;
};
