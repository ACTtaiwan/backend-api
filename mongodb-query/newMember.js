db.getCollection('entities').find({
    $and: [
        {_type: 4},
        {congressRoles: { $size: 1 } },
        {congressRoles: {
            $elemMatch: {
                congressNumbers: { $size: 1 }
            }
        }},        
        {congressRoles: {
            $elemMatch: {
                congressNumbers: { $in: [116] }
            }
        }}
    ]
})