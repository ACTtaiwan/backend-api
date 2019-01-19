db.getCollection('entities').find({
    $and: [
        {_type: 4},
        {congressRoles: {
            $elemMatch: {
                congressNumbers: { $in: [116] }
            }
        }}
    ]
})