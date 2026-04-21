const gengContentService = require('../services/gengContentService');

async function getAll(req, res) {
  try {
    const data = await gengContentService.getGengContentList();
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
}

async function remove(req, res) {
  const { id } = req.params;
  try {
    const result = await gengContentService.removeGengContent(id);
    res.json({ success: true, ...result });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
}

async function clear(req, res) {
  try {
    const result = await gengContentService.clearAllGengContent();
    res.json({ success: true, ...result });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
}

module.exports = {
  getAll,
  remove,
  clear
};