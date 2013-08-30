/*
 * App Controller
 */

define([], function () {

	var Controller = Em.Controller.extend({

		elements: Em.Object.create(),
		__remaining: -1,

		load: function () {

			/*
			 * This is decremented to know when loading is complete.
			 * There are 4 things to load. See __loaded below.
			 */
			this.__remaining = 5;

			this.set('elements.Flow', Em.ArrayProxy.create({content: []}));
			this.set('elements.Batch', Em.ArrayProxy.create({content: []}));
			this.set('elements.Stream', Em.ArrayProxy.create({content: []}));
			this.set('elements.Procedure', Em.ArrayProxy.create({content: []}));
			this.set('elements.Dataset', Em.ArrayProxy.create({content: []}));

			var self = this;
			var model = this.get('model');

			model.trackMetric('/store/bytes/apps/{id}', 'aggregates', 'storage');

			/*
			 * Load Streams
			 */
			this.HTTP.get('rest', 'apps', model.id, 'streams', function (objects) {

				var i = objects.length;
				while (i--) {

					objects[i] = C.Stream.create(objects[i]);

				}
				self.get('elements.Stream').pushObjects(objects);
				self.__loaded();

			});

			/*
			 * Load Flows
			 */
			this.HTTP.get('rest', 'apps', model.id, 'flows', function (objects) {

				var i = objects.length;
				while (i--) {
					objects[i] = C.Flow.create(objects[i]);
				}
				self.get('elements.Flow').pushObjects(objects);
				self.__loaded();

			});

      /*
       * Load Mapreduces
       */
      this.HTTP.get('rest', 'apps', model.id, 'mapreduce', function (objects) {

          var i = objects.length;
          while (i--) {
              objects[i] = C.Batch.create(objects[i]);
          }
          self.get('elements.Batch').pushObjects(objects);
          self.__loaded();

      });

			/*
			 * Load Datasets
			 */
			this.HTTP.get('rest', 'apps', model.id, 'datasets', function (objects) {

				var i = objects.length;
				while (i--) {
					objects[i] = C.Dataset.create(objects[i]);
				}
				self.get('elements.Dataset').pushObjects(objects);
				self.__loaded();

			});

			/*
			 * Load Procedures
			 */
			this.HTTP.get('rest', 'apps', model.id, 'procedures', function (objects) {

				var i = objects.length;
				while (i--) {
					objects[i] = C.Procedure.create(objects[i]);
				}
				self.get('elements.Procedure').pushObjects(objects);
				self.__loaded();

			});

		},

		__loaded: function () {

			if (!(--this.__remaining)) {

				var self = this;
				/*
				 * Give the chart Embeddables 100ms to configure
				 * themselves before updating.
				 */
				setTimeout(function () {
					self.updateStats();
				}, C.EMBEDDABLE_DELAY);

				this.interval = setInterval(function () {
					self.updateStats();
				}, C.POLLING_INTERVAL);

			}

		},

		unload: function () {

			clearInterval(this.interval);
			this.set('elements', Em.Object.create());

		},

		updateStats: function () {

			if (C.currentPath !== 'App') {
				return;
			}

			var self = this, types = ['Flow', 'Batch', 'Stream', 'Procedure', 'Dataset'];

			if (this.get('model')) {

				var i, models = [this.get('model')];
				for (i = 0; i < types.length; i ++) {
					models = models.concat(this.get('elements').get(types[i]).get('content'));
				}

				/*
				 * Hax until we have a pub/sub system for state.
				 */
				i = models.length;
				while (i--) {
					if (typeof models[i].updateState === 'function') {
						models[i].updateState(this.HTTP);
					}
				}
				/*
				 * End hax
				 */

				// Scans models for timeseries metrics and updates them.
				C.Util.updateTimeSeries(models, this.HTTP);

				// Scans models for aggregate metrics and udpates them.
				C.Util.updateAggregates(models, this.HTTP);

			}

		},

		hasRunnables: function () {

			var flow = this.get('elements.Flow.content');
			var mapreduce = this.get('elements.Batch.content');
			var procedure = this.get('elements.Procedure.content');

			if (!flow.length && !mapreduce.length && !procedure.length) {
				return false;
			}
			return true;

		}.property('elements.Flow', 'elements.Batch', 'elements.Procedure'),

		transition: function (elements, action, transition, endState, done) {

			var i = elements.length, model, app = this.get('model.id');
			var remaining = i;

			var HTTP = this.HTTP;

			while (i--) {

				if (elements[i].get('currentState') === transition ||
					elements[i].get('currentState') === endState) {
					remaining --;
					continue;
				}

				(function () {

					var model = elements[i];
					model.set('currentState', transition);

					HTTP.rpc('runnable', action, [app, model.get('name'),
						model.get('version'), model.get('type').toUpperCase()],
						function (response) {

							model.set('currentState', endState);
							if (!--remaining && typeof done === 'function') {
								done();
							}

					});

				})();

			}

		},

		startAll: function (kind) {

			var elements = this.get('elements.' + kind + '.content');

			C.Util.interrupt();
			this.transition(elements, 'start', 'starting', 'running', C.Util.proceed);

		},

		stopAll: function (kind) {

			var elements = this.get('elements.' + kind + '.content');

			C.Util.interrupt();
			this.transition(elements, 'stop', 'stopping', 'stopped', C.Util.proceed);

		},

		/*
		 * Application maintenance features
		 */

		"delete": function () {

			var self = this;

			C.Modal.show(
				"Delete Application",
				"Are you sure you would like to delete this Application? This action is not reversible.",
				$.proxy(function (event) {

					var app = this.get('model');

					C.get('far', {
						method: 'remove',
						params: [app.id]
					}, function () {

						self.transitionToRoute('index');

					});

				}, this));

		},

		/*
		 * Application promotion features
		 */

		promotePrompt: function () {

			var view = Em.View.create({
				controller: this,
				model: this.get('model'),
				templateName: 'promote',
				classNames: ['popup-modal', 'popup-full'],
				credentialBinding: 'C.Env.credential'
			});

			view.append();
			this.promoteReload();

		},

		promoteReload: function () {

			this.set('loading', true);

			var self = this;
			self.set('destinations', []);
			self.set('message', null);
			self.set('network', false);

			$.post('/credential', 'apiKey=' + C.Env.get('credential'),
				function (result, status) {

				$.getJSON('/destinations', function (result, status) {

					if (result === 'network') {

						self.set('network', true);

					} else {

						var destinations = [];

						for (var i = 0; i < result.length; i ++) {

							destinations.push({
								id: result[i].vpc_name,
								name: result[i].vpc_label + ' (' + result[i].vpc_name + '.continuuity.net)'
							});

						}

						self.set('destinations', destinations);

					}

					self.set('loading', false);

				});

			});

		}.observes('C.Env.credential'),

		promoteSubmit: function () {

			this.set("pushing", true);
			var model = this.get('model');
			var self = this;

			var destination = self.get('destination');
			if (!destination) {
				return;
			}

			destination += '.continuuity.net';

			this.HTTP.rpc('fabric', 'promote', [model.id, destination, C.Env.get('credential')],
				function (response) {

				if (response.error) {

					self.set('finished', 'Error');
					if (response.error.name) {
						self.set('finishedMessage', response.error.name + ': ' + response.error.message);
					} else {
						self.set('finishedMessage', response.result.message || JSON.stringify(response.error));
					}

				} else {

					self.set('finished', 'Success');
					self.set('finishedMessage', 'Successfully pushed to ' + destination + '.');
					self.set('finishedLink', 'https://' + destination + '/' + window.location.hash);
				}

				self.set("pushing", false);

			});

		}

	});

	Controller.reopenClass({
		type: 'App',
		kind: 'Controller'
	});

	return Controller;

});
