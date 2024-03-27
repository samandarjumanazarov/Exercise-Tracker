require('dotenv').config()
const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require("body-parser");
const mongoose = require('mongoose')
const {Schema} = require('mongoose')

mongoose.connect(process.env.DB_URI)

const userSchema = new Schema({
  username: { type: String, required: true },
  exercises: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' }]
})
const exerciseSchema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  description: {
    type: String,
    required: [true, "Description is required"]
  },
  duration: {
    type: Number,
    validate: {
      validator: function(value) {
        if (isNaN(value)) {
          throw new Error(`Cast to Number failed for value "${value}" (type ${typeof value}) at path "duration"`);
        }
        return true;
      },
      message: props => `Cast to Number failed for value "${props.value}" (type ${typeof props.value}) at path "duration"`
    },
    required: [true, "Path `duration` is required"]
  },
  date: {
    type: Date,
    default: Date.now, 
    set: function(date) {
      
      if (!date) {
        return undefined; 
      } else if (!(date instanceof Date)) {
        return new Date(date); 
      } else {
        return date; 
      }
    },
    get: function(date) {
      return date ? date.toDateString() : undefined;
    }
  }
})

const User = mongoose.model("User", userSchema)
const Exercise = mongoose.model("Exercise", exerciseSchema)

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cors())
app.use(express.static('public'))
app.use(express.json());
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// Endpoint starting
app.post('/api/users', async(req, res) => {
  try {
    const {username} = req.body
    const newUser = new User({username})
    const savedUser = await newUser.save()
    
    res.json({
      username: savedUser.username,
      _id: savedUser._id
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
})

app.get('/api/users', async(req, res) => {
  try {
    const users = await User.find()
    res.json(users)
    
  } catch (error) {
    console.log(error);
    res.json({ error: 'Internal server error' });
  }
})


app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    const { _id: urlId } = req.params; 
    const { description, duration, date } = req.body; 

    if (!urlId && !_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const userId = urlId || _id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.exercises) {
      user.exercises = [];
    }
    const exercise = new Exercise({
      userId: user._id,
      description,
      duration,
      date
    });

    await exercise.save();
    user.exercises.push(exercise);
    await user.save();

    res.json({
      _id: user._id,
      username: user.username,
      date: exercise.date,
      duration: exercise.duration,
      description: exercise.description
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const userId = req.params._id;
    const { from, to, limit } = req.query;
    
    // Find the user by _id
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const query = { userId };
    if (from) {
      query.date = { $gte: new Date(from) };
    }
    if (to) {
      query.date = { ...query.date, $lte: new Date(to) };
    }

    let exercisesQuery = Exercise.find(query);
    if (limit) {
      exercisesQuery = exercisesQuery.limit(parseInt(limit));
    }
    const exercises = await exercisesQuery.exec();
    const count = exercises.length;
    const log = exercises.map(exercise => ({
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString()
    }));

    
    res.json({
      _id: user._id,
      username: user.username,
      count,
      log
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
