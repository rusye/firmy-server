'use strict';

const express = require('express');
const router = express.Router();

// ---- activate passport later ----
// const passport = require('passport');

// ---- require passport/authentication later ---- 
// const { router: localStrategy, jwtStrategy, isAdmin } = require('./auth');
// passport.use(localStrategy);
// passport.use(jwtStrategy);
// const jwtAuth = passport.authenticate('jwt', {session: false});

const {Business} = require('./models');
const {Category} = require('../category/models');
const {User} = require('../users/models');

// GET request for categories in an area
router.get('/search', (req, res) => {
  Business
    .find({'address.coordinates': {$geoWithin: { $centerSphere: [[req.query.long, req.query.lat ], req.query.rad/3963.2]}}})
    .then(categories => {
      let catNames = []
      for (let i = 0; i < categories.length; i++) {
        if (catNames.indexOf(categories[i].category.name) === -1) {
          catNames.push(categories[i].category.name)
        }
      }
      res.json(catNames.sort())
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({message: 'Internal server error'})
    });
});

// GET request for businesses within a category
router.get('/:category/search', (req, res) => {
  Category
    .find({name: req.params.category})
    .then(cat => {
      if(cat.length === 0) {
        const message = 'Category not found';
        console.error(message);
        return res.status(404).send(message);
      } else {
        Business
          .find({'address.coordinates': {$geoWithin: { $centerSphere: [[req.query.long, req.query.lat ], req.query.rad/3963.2]}}})
          .sort('name')
          .then(businesses => {
            let items = businesses.filter(business => business.category.name === req.params.category)
            res.json(items.map(item => {
              return {
                id: item._id,
                name: item.name,
                city: item.address.city,
                state: item.address.state
              }
            }))
          })
          .catch(err => {
            console.log(err);
            res.status(500).json({message: 'Internal server error'})
          });
      }
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({message: 'Internal server error'})
    });
});

// GET request for a business
router.get('/:id', (req, res) => {
  Business.findById(req.params.id)
    .then(business => res.json(business.serialize()))
    .catch(err => {
      console.log(err);
      res.status(500).json({message: 'Internal server error'})
    });
});


// FUTURE UPDATE: Figure out how to check for business name also
// ---- Require jwtAuth later ----
// POST request to create a new business
router.post('/', (req, res) => {
  const requiredFields = ['name', 'category', 'address', 'hours', 'tel'];
  requiredFields.forEach(field => {
    if (!(field in req.body)) {
      const message = `Missing \`${field}\` in request body`;
      console.error(message);
      return res.status(400).send(message);
    }
  });

  User.findById(req.body.user_id)
    .then(user => {
      if (user) {
        Business.find({'name': req.body.name, 'address.street': req.body.address.street})
        .count()
        .then(count => {
          console.log(count, 'this is the count')
          if (count > 0) {
            return Promise.reject({
              code: 422,
              reason: 'ValidationError',
              message: 'This business already exists at this address',
              location: 'name and address'
            });
          }
          return count
        })
        .then(business => {
          return Business.create({
            user: req.body.user_id,
            name: req.body.name,
            category: req.body.category,
            address: req.body.address,
            hours: req.body.hours,
            tel: req.body.tel
          })
        })
        .then(business => {
          Category.findById(business.category).then(category => {
            if(!(category)) {
              const message = 'Category not found';
              console.error(message);
              return res.status(400).send(message);
            }
          });
          res.status(201).json({
            id: business.id,
            name: business.name,
            category: business.category,
            address: business.address,
            hours: business.hours,
            tel: business.tel
          });
        })
        .catch(err => {
          console.error(err);
          if (err.reason === 'ValidationError') {
            return res.status(err.code).json(err);
          }
          res.status(500).json({code: 500, message: 'Internal server error'});
        });
      }
      else {
        const message = 'User not found';
        console.error(message);
        return res.status(400).send(message);
      }
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({message: 'Something went wrong'});
    });
});


// ---- Require jwtAuth later ----
// PUT request to update a business
router.put('/:id', (req, res) => {
  if (!(req.params.id && req.body.id && req.params.id === req.body.id)) {
    res.status(400).json({message: `ID's do not match`});
  }

  const toUpdate = {};
  const updateableFields = ['user', 'name', 'category', 'address', 'hours', 'tel'] 
  updateableFields.forEach(field => {
    if (field in req.body) {
      toUpdate[field] = req.body[field];
    }
  });

  function dotNotate(obj,target,prefix) {
    target = target || {},
    prefix = prefix || '';
  
    Object.keys(obj).forEach(function(key) {
      if ( typeof(obj[key]) === 'object' ) {
        dotNotate(obj[key],target,prefix + key + '.');
      } else {
        return target[prefix + key] = obj[key];
      }
    });
  
    return target;
  }

  const theUpdate = dotNotate(toUpdate)

  // FUTURE UPDATE: If name change then also check that the business doesn't exist already
  Business
    .findByIdAndUpdate(req.params.id, {$set: theUpdate}, {new: true, runValidators: true})
    .then(updatedPost => res.status(204).end())
    .catch(err => res.status(500).json({message: err.message}));
})


// ---- Require jwtAuth later ----
// DELETE request to delete a business
router.delete('/:id', (req, res) => {
  Business
    .findById(req.params.id)
    .then(business => business.remove())
    .then(business => res.status(204).end())
    .catch(err => res.status(500).json({message: 'Internal server error'}));
});

module.exports = {router};