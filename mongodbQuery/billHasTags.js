db.getCollection('volunteer.bills').find(
  { $and: 
      [
        { tags: { $exists: true} },
        { tags: { $elemMatch: { userVote: { $gte: {} } } } }
      ]
  }
) 