import "@babel/polyfill";

import 'core-js/es6/map';
import 'core-js/es6/set';
import 'raf/polyfill';

import React, { Component, useEffect, useRef, useState } from 'react';
import './App.css';
import './Poker.css';

import Spinner from './Spinner';
import WinScreen from './WinScreen'

import Player from "./components/players/Player";
import ShowdownPlayer from "./components/players/ShowdownPlayer";
import Card from "./components/cards/Card";

import {
  generateDeckOfCards,
  shuffle,
  dealPrivateCards,
} from './utils/cards.js';

import {
  generateTable,
  beginNextRound,
  checkWin
} from './utils/players.js';

import {
  determineBlindIndices,
  anteUpBlinds,
  determineMinBet,
  handleBet,
  handleFold,
} from './utils/bet.js';

import {
  handleAI as handleAIUtil
} from './utils/ai.js';

import {
  renderShowdownMessages,
  renderActionButtonText,
  renderNetPlayerEarnings,
  renderActionMenu
} from './utils/ui.js';

import { cloneDeep } from 'lodash';

import {
  createSmartappDebugger,
  createAssistant,
} from "@sberdevices/assistant-client";

const initializeAssistant = (getState/*: any*/) => {
  if (process.env.NODE_ENV === "production") {
    return createSmartappDebugger({
      token: process.env.REACT_APP_TOKEN,
      initPhrase: `Запусти ${process.env.REACT_APP_SMARTAPP}`,
      getState,
    });
  }
  return createAssistant({ getState });
};


export class App extends React.Component {

  cardAnimationDelay = 0;

  loadTable = () => {

  }

  async componentDidMount() {
    const players = await generateTable();
    const dealerIndex = Math.floor(Math.random() * Math.floor(players.length));
    const blindIndicies = determineBlindIndices(dealerIndex, players.length);
    const playersBoughtIn = anteUpBlinds(players, blindIndicies, this.state.minBet);

    const imageLoaderRequest = new XMLHttpRequest();


    imageLoaderRequest.addEventListener("load", e => {
      console.log(`${e.type}`);
      console.log(e);
      console.log("Image Loaded!");
      this.setState({
        loading: false,
      })
    });

    imageLoaderRequest.addEventListener("error", e => {
      console.log(`${e.type}`);
      console.log(e);
    });


    imageLoaderRequest.addEventListener("loadstart", e => {
      console.log(`${e.type}`);
      console.log(e);
    });

    imageLoaderRequest.addEventListener("loadend", e => {
      console.log(`${e.type}`);
      console.log(e);
    });

    imageLoaderRequest.addEventListener("abort", e => {
      console.log(`${e.type}`);
      console.log(e);
    });

    imageLoaderRequest.addEventListener("progress", e => {
      console.log(`${e.type}`);
      console.log(e);
    });

    imageLoaderRequest.open("GET", "./assets/table-nobg-svg-01.svg");
    imageLoaderRequest.send();

    this.setState(prevState => ({

      // loading: false,
      players: playersBoughtIn,
      numPlayersActive: players.length,
      numPlayersFolded: 0,
      numPlayersAllIn: 0,
      activePlayerIndex: dealerIndex,
      dealerIndex,
      blindIndex: {
        big: blindIndicies.bigBlindIndex,
        small: blindIndicies.smallBlindIndex,
      },
      deck: shuffle(generateDeckOfCards()),
      pot: 0,
      highBet: prevState.minBet,
      betInputValue: prevState.minBet,
      phase: 'initialDeal',
    }))
    this.runGameLoop();
  }

  constructor(props) {
    super(props);
    console.log('constructor');


    this.state = {
      loading: true,
      winnerFound: null,
      players: null,
      numPlayersActive: null,
      numPlayersFolded: null,
      numPlayersAllIn: null,
      activePlayerIndex: null,
      dealerIndex: null,
      blindIndex: null,
      deck: null,
      communityCards: [],
      pot: null,
      highBet: null,
      betInputValue: null,
      sidePots: [],
      minBet: 20,
      phase: 'loading',
      playerHierarchy: [],
      showDownMessages: [],
      playActionMessages: [],
      notes: [],
      playerAnimationSwitchboard: {
        0: { isAnimating: false, content: null },
        1: { isAnimating: false, content: null },
        2: { isAnimating: false, content: null },
        3: { isAnimating: false, content: null },
        4: { isAnimating: false, content: null },
        5: { isAnimating: false, content: null }
      }
    }

    this.assistant = initializeAssistant(() => this.getStateForAssistant());
    this.assistant.on("data", (event/*: any*/) => {
      console.log(`assistant.on(data)`, event);
      const { action } = event
      this.dispatchAssistantAction(action);
    });
    this.assistant.on("start", (event) => {
      console.log(`assistant.on(start)`, event);
    });

  }
  handleBetInputChange = (val, min, max) => {
    if (val === '') val = min
    if (val > max) val = max
    this.setState({
      betInputValue: parseInt(val, 10),
    });
  }

  changeSliderInput = (val) => {
    this.setState({
      betInputValue: val[0]
    })
  }

  pushAnimationState = (index, content) => {
    const newAnimationSwitchboard = Object.assign(
      {},
      this.state.playerAnimationSwitchboard,
      { [index]: { isAnimating: true, content } }
    )
    this.setState({ playerAnimationSwitchboard: newAnimationSwitchboard });
  }

  popAnimationState = (index) => {
    const persistContent = this.state.playerAnimationSwitchboard[index].content;
    const newAnimationSwitchboard = Object.assign(
      {},
      this.state.playerAnimationSwitchboard,
      { [index]: { isAnimating: false, content: persistContent } }
    )
    this.setState({ playerAnimationSwitchboard: newAnimationSwitchboard });
  }

  handleBetInputSubmit = (bet, min, max) => {
    const { playerAnimationSwitchboard, ...appState } = this.state;
    const { activePlayerIndex } = appState;
    this.pushAnimationState(activePlayerIndex, `${renderActionButtonText(this.state.highBet, this.state.betInputValue, this.state.players[this.state.activePlayerIndex])} ${(bet > this.state.players[this.state.activePlayerIndex].bet) ? (bet) : ""}`);;
    const newState = handleBet(cloneDeep(appState), parseInt(bet, 10), parseInt(min, 10), parseInt(max, 10));
    this.setState(newState, () => {
      if ((this.state.players[this.state.activePlayerIndex].robot) && (this.state.phase !== 'showdown')) {
        setTimeout(() => {

          this.handleAI()
        }, 1200)
      }
    });
  }

  handleFold = () => {
    const { playerAnimationSwitchboard, ...appState } = this.state
    const newState = handleFold(cloneDeep(appState));
    this.setState(newState, () => {
      if ((this.state.players[this.state.activePlayerIndex].robot) && (this.state.phase !== 'showdown')) {
        setTimeout(() => {

          this.handleAI()
        }, 1200)
      }
    })
  }

  handleAI = () => {
    const { playerAnimationSwitchboard, ...appState } = this.state;
    const newState = handleAIUtil(cloneDeep(appState), this.pushAnimationState)

    this.setState({
      ...newState,
      betInputValue: newState.minBet
    }, () => {
      if ((this.state.players[this.state.activePlayerIndex].robot) && (this.state.phase !== 'showdown')) {
        setTimeout(() => {

          this.handleAI()
        }, 1200)
      }
    })
  }

  renderBoard = () => {
    const {
      players,
      activePlayerIndex,
      dealerIndex,
      clearCards,
      phase,
      playerAnimationSwitchboard
    } = this.state;
    // Reverse Players Array for the sake of taking turns counter-clockwise.
    const reversedPlayers = players.reduce((result, player, index) => {

      const isActive = (index === activePlayerIndex);
      const hasDealerChip = (index === dealerIndex);


      result.unshift(
        <Player
          key={index}
          arrayIndex={index}
          isActive={isActive}
          hasDealerChip={hasDealerChip}
          player={player}
          clearCards={clearCards}
          phase={phase}
          playerAnimationSwitchboard={playerAnimationSwitchboard}
          endTransition={this.popAnimationState}
        />
      )
      return result
    }, []);
    return reversedPlayers.map(component => component);
  }

  renderCommunityCards = (purgeAnimation) => {
    return this.state.communityCards.map((card, index) => {
      let cardData = { ...card };
      if (purgeAnimation) {
        cardData.animationDelay = 0;
      }
      return (
        <Card key={index} cardData={cardData} />
      );
    });
  }

  runGameLoop = () => {
    const newState = dealPrivateCards(cloneDeep(this.state))
    this.setState(newState, () => {
      if ((this.state.players[this.state.activePlayerIndex].robot) && (this.state.phase !== 'showdown')) {
        setTimeout(() => {
          this.handleAI()
        }, 1200)
      }
    })
  }

  renderRankTie = (rankSnapshot) => {
    return rankSnapshot.map(player => {
      return this.renderRankWinner(player);
    })
  }

  renderRankWinner = (player) => {
    const { name, bestHand, handRank } = player;
    const playerStateData = this.state.players.find(statePlayer => statePlayer.name === name);
    return (
      <div className="showdown-player--entity" key={name}>
        <ShowdownPlayer
          name={name}
          avatarURL={playerStateData.avatarURL}
          cards={playerStateData.cards}
          roundEndChips={playerStateData.roundEndChips}
          roundStartChips={playerStateData.roundStartChips}
        />
        <div className="showdown-player--besthand--container">
          <h5 className="showdown-player--besthand--heading">
            Лучшая рука
          </h5>
          <div className='showdown-player--besthand--cards' style={{ alignItems: 'center' }}>
            {
              bestHand.map((card, index) => {
                // Reset Animation Delay
                const cardData = { ...card, animationDelay: 0 }
                return <Card key={index} cardData={cardData} />
              })
            }
          </div>
        </div>
        <div className="showdown--handrank">
          {handRank}
        </div>
        {renderNetPlayerEarnings(playerStateData.roundEndChips, playerStateData.roundStartChips)}
      </div>
    )
  }

  renderBestHands = () => {
    const { playerHierarchy } = this.state;

    return playerHierarchy.map(rankSnapshot => {
      const tie = Array.isArray(rankSnapshot);
      return tie ? this.renderRankTie(rankSnapshot) : this.renderRankWinner(rankSnapshot);
    })
  }

  handleNextRound = () => {
    this.setState({ clearCards: true })
    const newState = beginNextRound(cloneDeep(this.state))
    // Check win condition
    if (checkWin(newState.players)) {
      this.setState({ winnerFound: true })
      return;
    }
    this.setState(newState, () => {
      if ((this.state.players[this.state.activePlayerIndex].robot) && (this.state.phase !== 'showdown')) {
        setTimeout(() => this.handleAI(), 1200)
      }
    })
  }

  renderActionButtons = () => {
    const { highBet, players, activePlayerIndex, phase, betInputValue } = this.state
    const min = determineMinBet(highBet, players[activePlayerIndex].chips, players[activePlayerIndex].bet)
    const max = players[activePlayerIndex].chips + players[activePlayerIndex].bet
    return ((players[activePlayerIndex].robot) || (phase === 'showdown')) ? null : (
      <React.Fragment>
        <div className = "min-bet">
          минимальная ставка: {min}
        </div>
        {/* <button className='action-button' onClick={() => this.handleBetInputSubmit(betInputValue, min, max)}>
          {renderActionButtonText(highBet, betInputValue, players[activePlayerIndex])}
        </button>
        <button className='fold-button' onClick={() => this.handleFold()}>
          Fold
        </button> */}
      </React.Fragment>
    )
  }

  renderShowdown = () => {
    return (
      <div className='showdown-container--wrapper'>
        <h5 className="showdown-container--title">
          Раунд завершён!
        </h5>
        <div className="showdown-container--messages">
          {renderShowdownMessages(this.state.showDownMessages)}
        </div>
        <h5 className="showdown-container--community-card-label">
          Общии карты
        </h5>
        <div className='showdown-container--community-cards'>
          {this.renderCommunityCards(true)}
        </div>
        <button className="showdown--nextRound--button" onClick={() => this.handleNextRound()}> Следующий Раунд </button>
        { this.renderBestHands()}
      </div>
    )
  }

  renderGame = () => {
    const { highBet, players, activePlayerIndex, phase } = this.state;
    return (
      <div className='poker-app--background'>
        <div className="poker-table--container">
          <img className="poker-table--table-image" src={"./assets/table-nobg-svg-01.svg"} alt="Poker Table" />
          {this.renderBoard()}
          <div className='community-card-container' >
            {this.renderCommunityCards()}
          </div>
          <div className='pot-container'>
            <img style={{ height: 55, width: 55 }} src={'./assets/pot.svg'} alt="Pot Value" />
            <h4> {`${this.state.pot}`} </h4>
          </div>
        </div>
        { (this.state.phase === 'showdown') && this.renderShowdown()}
        <div className='game-action-bar' >
          <div className='action-buttons'>
            {this.renderActionButtons()}
          </div>
          <div className='slider-boi'>
            {(!this.state.loading) && renderActionMenu(highBet, players, activePlayerIndex, phase, this.handleBetInputChange)}
          </div>
        </div>
      </div>
    )
  }
  getStateForAssistant() {
    console.log('getStateForAssistant: this.state:', this.state)
    const state = {
      item_selector: {
        items: this.state.notes.map(
          ({ id, title }, index) => ({
            number: index + 1,
            id,
            title,
          })
        ),
      },
    };
    console.log('getStateForAssistant: state:', state)
    return state;
  }


  sendFine = () => {
    this.assistant.sendData({action:{type: `Fine`}});
  }
  
  sendMoreOrLess = () =>{
    this.assistant.sendData({action: {action_id: "MoreOrLess"}}); 
  }


  dispatchAssistantAction(action) {
    console.log('dispatchAssistantAction', action);
    if (action) {
      switch (action.type) {
        case 'add_note':          //handle carts
          return this.handleFold();

        case 'done_note':
          var { highBet, players, activePlayerIndex, betInputValue } = this.state
          var min = determineMinBet(highBet, players[activePlayerIndex].chips, players[activePlayerIndex].bet)
          var max = players[activePlayerIndex].chips + players[activePlayerIndex].bet
          return this.handleBetInputSubmit(betInputValue, min, max);

        case 'delete_note':       //Star next round
          return this.handleNextRound();

        case 'flip_card':
          var { highBet, players, activePlayerIndex, betInputValue,minBet } = this.state
          var min = determineMinBet(highBet, players[activePlayerIndex].chips, players[activePlayerIndex].bet)
          var max = players[activePlayerIndex].chips + players[activePlayerIndex].bet
          if (action.data > players[activePlayerIndex].chips) {
            return;
          }
          if (action.data < this.minBet){
            return;
          }

          this.handleBetInputChange(action.data, min, max);
          this.changeSliderInput(action.data);
          this.handleBetInputSubmit(action.data, min, max);
          break;
        default:
          throw new Error();
      }
    }
  }


  render() {
    return (
      <div className="App">
        <div className='poker-table--wrapper'>
          {
            (this.state.loading) ? <Spinner /> :
              (this.state.winnerFound) ? <WinScreen /> :
                this.renderGame()
          }
        </div>
      </div>
    );
  }
}

export default App;
