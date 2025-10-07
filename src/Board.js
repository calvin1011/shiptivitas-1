import React from 'react';
import Dragula from 'dragula';
import 'dragula/dist/dragula.css';
import Swimlane from './Swimlane';
import './Board.css';

// API endpoint for backend server
const API_URL = 'http://localhost:3001/api/v1/clients';

export default class Board extends React.Component {
  constructor(props) {
    super(props);
    // initialize state with empty arrays. data will be fetched from the API.
    this.state = {
      clients: {
        backlog: [],
        inProgress: [],
        complete: [],
      }
    }
    this.swimlanes = {
      backlog: React.createRef(),
      inProgress: React.createRef(),
      complete: React.createRef(),
    }
  }

  // helper function to organize the flat list of clients from the API
  // into the swimlane structure required by the component's state.
  processClients = (clientsData) => {
    // sort clients by priority to ensure they are in the correct order
    clientsData.sort((a, b) => a.priority - b.priority);

    this.setState({
      clients: {
        backlog: clientsData.filter(c => c.status === 'backlog'),
        inProgress: clientsData.filter(c => c.status === 'in-progress'),
        complete: clientsData.filter(c => c.status === 'complete'),
      }
    });
  }

  componentDidMount() {
    // fetch the initial data from the backend when the component loads.
    fetch(API_URL)
      .then(response => response.json())
      .then(this.processClients);

    const statusMap = {
      'backlog': 'backlog',
      'in-progress': 'inProgress',
      'complete': 'complete',
    };

    const drake = Dragula([
      this.swimlanes.backlog.current,
      this.swimlanes.inProgress.current,
      this.swimlanes.complete.current,
    ]);

    drake.on('drop', (el, target, source, sibling) => {
      drake.cancel(true);
      if (!target || !source) return;

      const cardId = el.dataset.id;
      const targetStatus = target.dataset.status;

      // calculate the new priority based on the card's position in the target list.
      // sibling is the next card in the list, so we use its index.
      // if there's no sibling, the card is at the end, so its priority is the list length + 1.
      const newPriority = sibling
        ? this.state.clients[statusMap[targetStatus]].findIndex(c => c.id === parseInt(sibling.dataset.id, 10)) + 1
        : this.state.clients[statusMap[targetStatus]].length + 1;

      // We'll update the UI immediately for a smooth user experience,
      // and then sync with the server's response.
      const allClients = [
        ...this.state.clients.backlog,
        ...this.state.clients.inProgress,
        ...this.state.clients.complete
      ];
      const cardToMove = allClients.find(c => c.id === parseInt(cardId, 10));
      if (!cardToMove) return;

      const clients = { ...this.state.clients };
      const sourceLaneKey = statusMap[source.dataset.status];
      const targetLaneKey = statusMap[target.dataset.status];

      clients[sourceLaneKey] = clients[sourceLaneKey].filter(c => c.id !== parseInt(cardId, 10));

      const targetCards = [...clients[targetLaneKey]];
      const insertIndex = sibling
        ? targetCards.findIndex(c => c.id === parseInt(sibling.dataset.id, 10))
        : targetCards.length;

      cardToMove.status = targetStatus;
      targetCards.splice(insertIndex, 0, cardToMove);
      clients[targetLaneKey] = targetCards;

      this.setState({ clients });

      // API Call to backend
      // Send the updated status and priority to the server.
      fetch(`${API_URL}/${cardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: targetStatus,
          priority: newPriority
        }),
      })
      .then(response => response.json())
      .then(this.processClients); // Re-sync with the database state after update.
    });
  }

  renderSwimlane(name, clients, ref, status) {
    return (
      <Swimlane name={name} clients={clients} dragulaRef={ref} status={status} />
    );
  }

  render() {
    return (
      <div className="Board">
        <div className="container-fluid">
          <div className="row">
            <div className="col-md-4">
              {this.renderSwimlane('Backlog', this.state.clients.backlog, this.swimlanes.backlog, 'backlog')}
            </div>
            <div className="col-md-4">
              {this.renderSwimlane('In Progress', this.state.clients.inProgress, this.swimlanes.inProgress, 'in-progress')}
            </div>
            <div className="col-md-4">
              {this.renderSwimlane('Complete', this.state.clients.complete, this.swimlanes.complete, 'complete')}
            </div>
          </div>
        </div>
      </div>
    );
  }
}