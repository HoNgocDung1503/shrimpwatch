const counts = db.metrics.aggregate([
  {$group: {_id: {metric:"$metadata.metric", source:"$metadata.source"}, count: {$sum:1}}},
  {$sort: {"_id.metric":1}}
]).toArray();
print("Tong so ban ghi trong metrics:", db.metrics.countDocuments());
print("Theo (metric, source):");
counts.forEach(c => print("  " + (c._id.metric||"").padEnd(14) + " | " + (c._id.source||"").padEnd(8) + " | " + c.count));
