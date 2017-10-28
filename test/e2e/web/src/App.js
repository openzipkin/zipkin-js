import React, { Component } from "react";
import "./App.css";
import Basic from "./screens/Basic";

class App extends Component {
  state = {
    screen: false
  };

  renderScreenButton(title, component) {
    return (
      <a
        id={title}
        onClick={() => {
          this.setState({ screen: component });
        }}
      >
        <span style={{ color: "blue", marginBottom: 20 }}>{title}</span>
      </a>
    );
  }

  render() {
    if (!this.state.screen) {
      return (
        <div className="App">{this.renderScreenButton("Basic", Basic)}</div>
      );
    }

    const Screen = this.state.screen;
    return <Screen />;
  }
}

export default App;
