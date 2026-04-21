const workCpService = require('../services/workCpService');

async function getAll(req, res) {
  try {
    const data = await workCpService.getWorkCpList();
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
}

async function create(req, res) {
  const { workName, cpName } = req.body;
  try {
    const result = await workCpService.addWorkCp(workName, cpName);
    res.json({ success: true, ...result });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
}

async function remove(req, res) {
  const { id } = req.params;
  try {
    const result = await workCpService.removeWorkCp(id);
    res.json({ success: true, ...result });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
}

module.exports = {
  getAll,
  create,
  remove
};