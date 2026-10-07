const catalog = db.aggregate([{$listCatalog:{}}]).toArray();
const info = catalog.find(x => x.name === "metrics");
if (!info) {
  print("Chua tao metrics collection. Hay chay init_db truoc!");
  quit(1);
}
print("Collection metrics:", info.name);
print("  timeseries.timeField   :", info.md.timeseries.timeField);
print("  timeseries.metaField   :", info.md.timeseries.metaField);
print("  timeseries.granularity :", info.md.timeseries.granularity);
print("  expireAfterSeconds TTL :", info.md.options.expireAfterSeconds, "(~", Math.round(info.md.options.expireAfterSeconds/3600/24), "ngay)");
const ponds = db.ponds.find({}, {_id:1, name:1}).toArray();
print("So ao da seed:", ponds.length);
ponds.forEach(p => print("  -", p._id, "  --  ", p.name));
